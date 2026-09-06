// controllers/holiday.controller.js - Sequelize Version
const { Holiday, Branch, Company } = require('../models');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { Op } = require('sequelize');

module.exports = {
  // @desc Create a holiday
  createHoliday: async (req, res, next) => {
    try {
      const { name, date, type, description, branchId } = req.body;
      const companyId = req.user.company_id || req.body.companyId;

      // Check if holiday already exists on this date for this company/branch
      const existing = await Holiday.findOne({
        where: {
          company_id: companyId,
          branch_id: branchId || null,
          date: date
        }
      });
      if (existing) {
        throw new ApiError(400, 'A holiday already exists on this date');
      }

      const holiday = await Holiday.create({
        company_id: companyId,
        branch_id: branchId || null,
        name,
        date,
        type: type || 'national',
        description: description || ''
      });

      const created = await Holiday.findByPk(holiday.id, {
        include: [
          { model: Branch, as: 'branch', attributes: ['id', 'name'] },
          { model: Company, as: 'company', attributes: ['id', 'name'] }
        ]
      });

      res.status(201).json(new ApiResponse(201, created, 'Holiday created'));
    } catch (error) {
      next(error);
    }
  },

  // @desc Get all holidays
  getHolidays: async (req, res, next) => {
    try {
      const { year, month, branchId, type } = req.query;
      const companyId = req.user.company_id;

      const where = { company_id: companyId };

      if (year) {
        where.year = parseInt(year);
      }
      if (month) {
        where.month = parseInt(month);
      }
      if (type) {
        where.type = type;
      }
      if (branchId) {
        where[Op.or] = [
          { branch_id: branchId },
          { branch_id: null }
        ];
      }

      const holidays = await Holiday.findAll({
        where,
        include: [
          { model: Branch, as: 'branch', attributes: ['id', 'name'] }
        ],
        order: [['date', 'ASC']]
      });

      res.json(new ApiResponse(200, holidays));
    } catch (error) {
      next(error);
    }
  },

  // @desc Get single holiday
  getHoliday: async (req, res, next) => {
    try {
      const holiday = await Holiday.findByPk(req.params.id, {
        include: [
          { model: Branch, as: 'branch', attributes: ['id', 'name'] }
        ]
      });

      if (!holiday) {
        throw new ApiError(404, 'Holiday not found');
      }

      res.json(new ApiResponse(200, holiday));
    } catch (error) {
      next(error);
    }
  },

  // @desc Update a holiday
  updateHoliday: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, date, type, description, branchId } = req.body;

      const holiday = await Holiday.findByPk(id);
      if (!holiday) {
        throw new ApiError(404, 'Holiday not found');
      }

      const updateData = {};
      if (name) updateData.name = name;
      if (date) updateData.date = date;
      if (type) updateData.type = type;
      if (description !== undefined) updateData.description = description;
      if (branchId !== undefined) updateData.branch_id = branchId || null;

      await holiday.update(updateData);

      const updated = await Holiday.findByPk(id, {
        include: [
          { model: Branch, as: 'branch', attributes: ['id', 'name'] }
        ]
      });

      res.json(new ApiResponse(200, updated, 'Holiday updated'));
    } catch (error) {
      next(error);
    }
  },

  // @desc Delete a holiday
  deleteHoliday: async (req, res, next) => {
    try {
      const deleted = await Holiday.destroy({
        where: { id: req.params.id }
      });

      if (deleted === 0) {
        throw new ApiError(404, 'Holiday not found');
      }

      res.json(new ApiResponse(200, null, 'Holiday deleted'));
    } catch (error) {
      next(error);
    }
  },

  // @desc Bulk create holidays
  bulkCreateHolidays: async (req, res, next) => {
    try {
      const { holidays } = req.body;
      const companyId = req.user.company_id || req.body.companyId;

      if (!Array.isArray(holidays) || holidays.length === 0) {
        throw new ApiError(400, 'holidays array is required');
      }

      let inserted = 0;
      let errors = [];

      for (const h of holidays) {
        try {
          await Holiday.create({
            company_id: companyId,
            branch_id: h.branchId || null,
            name: h.name,
            date: h.date,
            type: h.type || 'national',
            description: h.description || ''
          });
          inserted++;
        } catch (error) {
          if (error.name === 'SequelizeUniqueConstraintError') {
            errors.push(`${h.name} on ${h.date} already exists`);
          } else {
            errors.push(error.message);
          }
        }
      }

      const message = inserted > 0 
        ? `${inserted} holidays created${errors.length > 0 ? `, ${errors.length} skipped` : ''}`
        : 'No holidays were created';

      res.status(inserted > 0 ? 201 : 400).json(
        new ApiResponse(inserted > 0 ? 201 : 400, { inserted, errors }, message)
      );
    } catch (error) {
      next(error);
    }
  }
};