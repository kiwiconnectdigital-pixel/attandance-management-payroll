// controllers/branch.controller.js - Sequelize Version
const { Branch, Employee, Company, sequelize } = require('../models');
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const { geocodeFromText } = require("../services/geocoding.service");
const { Op } = require('sequelize');

module.exports = {
  // @desc Get all branches for a company
  getBranches: async (req, res, next) => {
    try {
      const user = req.user;
      
      let where = { is_active: true };

      if (user.role === 'company_admin' || user.role === 'hr') {
        where.company_id = user.company_id;
      } else if (user.role === 'employee') {
        const employee = await Employee.findOne({ where: { user_id: user.id } });
        if (employee) {
          where.id = employee.branch_id;
        }
      }

      const branches = await Branch.findAll({
        where,
        include: [
          {
            model: Employee,
            as: 'manager',
            attributes: ['id', 'name']
          },
          {
            model: Company,
            as: 'company',
            attributes: ['id', 'name']
          }
        ],
        attributes: {
          include: [
            [
              sequelize.literal(`(
                SELECT COUNT(*) FROM employees 
                WHERE employees.branch_id = Branch.id 
                AND employees.is_active = TRUE
              )`),
              'employee_count'
            ]
          ]
        },
        order: [['name', 'ASC']]
      });

      res.json(new ApiResponse(200, branches));
    } catch (error) {
      next(error);
    }
  },

  // @desc Create branch
  createBranch: async (req, res, next) => {
    try {
      const { name, code, address, city, state, pincode, phone, email, managerId, geofence } = req.body;

      const companyId = req.user.company_id || req.body.companyId;

      // Check if branch code already exists for this company
      const existing = await Branch.findOne({
        where: { company_id: companyId, code }
      });
      if (existing) {
        throw new ApiError(400, "Branch with this code already exists");
      }

      // Resolve geofence from address if not provided
      let geofenceLat = geofence?.latitude || null;
      let geofenceLng = geofence?.longitude || null;
      let geofenceAddress = geofence?.address || null;

      if (!geofenceLat || !geofenceLng) {
        const locationQuery = geofence?.address || `${address}, ${city}, ${state}`;
        const geo = await geocodeFromText(locationQuery);
        if (geo) {
          geofenceLat = geo.latitude;
          geofenceLng = geo.longitude;
          geofenceAddress = geo.displayName || geofenceAddress;
        }
      }

      const branch = await Branch.create({
        company_id: companyId,
        name,
        code,
        address,
        city,
        state,
        pincode,
        phone,
        email,
        manager_id: managerId || null,
        is_active: true,
        geofence_enabled: geofence?.enabled || false,
        geofence_latitude: geofenceLat,
        geofence_longitude: geofenceLng,
        geofence_radius_meters: geofence?.radiusMeters || 100,
        geofence_address: geofenceAddress || ''
      });

      const created = await Branch.findByPk(branch.id, {
        include: [
          { model: Employee, as: 'manager', attributes: ['id', 'name'] },
          { model: Company, as: 'company', attributes: ['id', 'name'] }
        ]
      });

      res.status(201).json(new ApiResponse(201, created, "Branch created"));
    } catch (error) {
      next(error);
    }
  },

  // @desc Update branch
  updateBranch: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, code, address, city, state, pincode, phone, email, managerId, geofence } = req.body;

      const branch = await Branch.findByPk(id);
      if (!branch) {
        throw new ApiError(404, "Branch not found");
      }

      const updateData = {};

      if (name) updateData.name = name;
      if (code) updateData.code = code;
      if (address) updateData.address = address;
      if (city) updateData.city = city;
      if (state) updateData.state = state;
      if (pincode) updateData.pincode = pincode;
      if (phone) updateData.phone = phone;
      if (email) updateData.email = email;
      if (managerId !== undefined) updateData.manager_id = managerId || null;

      if (geofence) {
        let geofenceLat = geofence.latitude || null;
        let geofenceLng = geofence.longitude || null;
        let geofenceAddress = geofence.address || null;

        if (!geofenceLat || !geofenceLng) {
          const locationQuery = geofence.address || `${address || branch.address}, ${city || branch.city}, ${state || branch.state}`;
          const geo = await geocodeFromText(locationQuery);
          if (geo) {
            geofenceLat = geo.latitude;
            geofenceLng = geo.longitude;
            geofenceAddress = geo.displayName || geofenceAddress;
          }
        }

        updateData.geofence_enabled = geofence.enabled || false;
        updateData.geofence_latitude = geofenceLat;
        updateData.geofence_longitude = geofenceLng;
        updateData.geofence_radius_meters = geofence.radiusMeters || 100;
        updateData.geofence_address = geofenceAddress || '';
      }

      await branch.update(updateData);

      const updated = await Branch.findByPk(id, {
        include: [
          { model: Employee, as: 'manager', attributes: ['id', 'name'] },
          { model: Company, as: 'company', attributes: ['id', 'name'] }
        ]
      });

      res.json(new ApiResponse(200, updated, "Branch updated"));
    } catch (error) {
      next(error);
    }
  },

  // @desc Delete (soft delete) branch
  deleteBranch: async (req, res, next) => {
    try {
      const { id } = req.params;

      const branch = await Branch.findByPk(id);
      if (!branch) {
        throw new ApiError(404, "Branch not found");
      }

      await branch.update({ is_active: false });

      res.json(new ApiResponse(200, null, "Branch deactivated"));
    } catch (error) {
      next(error);
    }
  },

  // @desc Update geofence settings
  updateGeofence: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { enabled, latitude, longitude, radiusMeters, address, locationQuery } = req.body;

      const branch = await Branch.findByPk(id);
      if (!branch) {
        throw new ApiError(404, "Branch not found");
      }

      let geofenceLat = latitude || null;
      let geofenceLng = longitude || null;
      let geofenceAddress = address || null;

      if (!geofenceLat || !geofenceLng) {
        const query = locationQuery || address || branch.address;
        const geo = await geocodeFromText(query);
        if (geo) {
          geofenceLat = geo.latitude;
          geofenceLng = geo.longitude;
          geofenceAddress = geo.displayName || geofenceAddress;
        }
      }

      await branch.update({
        geofence_enabled: enabled || false,
        geofence_latitude: geofenceLat,
        geofence_longitude: geofenceLng,
        geofence_radius_meters: radiusMeters || 100,
        geofence_address: geofenceAddress || ''
      });

      const updated = await Branch.findByPk(id);

      res.json(new ApiResponse(200, updated, "Geofence updated"));
    } catch (error) {
      next(error);
    }
  }
};