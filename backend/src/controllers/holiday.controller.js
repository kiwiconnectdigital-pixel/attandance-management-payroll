const Holiday     = require('../models/Holiday.model');
const ApiResponse = require('../utils/ApiResponse');
const ApiError    = require('../utils/ApiError');

module.exports = {
  // @desc  Create a holiday
  // @route POST /api/v1/holidays
  createHoliday: async (req, res, next) => {
    try {
      const { name, date, type, description, branch } = req.body;

      const holiday = await Holiday.create({
        name,
        date: new Date(date),
        type,
        description,
        branch: branch || null,
      });

      res.status(201).json(new ApiResponse(201, holiday, 'Holiday created'));
    } catch (error) {
      if (error.code === 11000) {
        return next(new ApiError(400, 'A holiday already exists on this date'));
      }
      next(error);
    }
  },

  // @desc  Get all holidays (filter by year, month, branch)
  // @route GET /api/v1/holidays
  getHolidays: async (req, res, next) => {
    try {
      const { year, month, branch, type } = req.query;
      const filter = {};

      if (year)   filter.year  = parseInt(year);
      if (month)  filter.month = parseInt(month);
      if (type)   filter.type  = type;
      if (branch) filter.$or   = [{ branch }, { branch: null }];

      const holidays = await Holiday.find(filter)
        .populate('branch', 'name')
        .sort({ date: 1 });

      res.json(new ApiResponse(200, holidays));
    } catch (error) {
      next(error);
    }
  },

  // @desc  Get single holiday
  // @route GET /api/v1/holidays/:id
  getHoliday: async (req, res, next) => {
    try {
      const holiday = await Holiday.findById(req.params.id).populate('branch', 'name');
      if (!holiday) throw new ApiError(404, 'Holiday not found');
      res.json(new ApiResponse(200, holiday));
    } catch (error) {
      next(error);
    }
  },

  // @desc  Update a holiday
  // @route PUT /api/v1/holidays/:id
  updateHoliday: async (req, res, next) => {
    try {
      const { name, date, type, description, branch } = req.body;

      const holiday = await Holiday.findById(req.params.id);
      if (!holiday) throw new ApiError(404, 'Holiday not found');

      if (name)        holiday.name        = name;
      if (date)        holiday.date        = new Date(date);
      if (type)        holiday.type        = type;
      if (description !== undefined) holiday.description = description;
      if (branch !== undefined)      holiday.branch      = branch || null;

      await holiday.save(); // triggers pre-save hook to recompute isWeekday/year/month

      res.json(new ApiResponse(200, holiday, 'Holiday updated'));
    } catch (error) {
      if (error.code === 11000) {
        return next(new ApiError(400, 'A holiday already exists on this date'));
      }
      next(error);
    }
  },

  // @desc  Delete a holiday
  // @route DELETE /api/v1/holidays/:id
  deleteHoliday: async (req, res, next) => {
    try {
      const holiday = await Holiday.findByIdAndDelete(req.params.id);
      if (!holiday) throw new ApiError(404, 'Holiday not found');
      res.json(new ApiResponse(200, null, 'Holiday deleted'));
    } catch (error) {
      next(error);
    }
  },

  // @desc  Bulk create holidays (e.g. import full year at once)
  // @route POST /api/v1/holidays/bulk
  bulkCreateHolidays: async (req, res, next) => {
    try {
      const { holidays } = req.body;
      // holidays = [{ name, date, type, description, branch }, ...]

      if (!Array.isArray(holidays) || holidays.length === 0) {
        throw new ApiError(400, 'holidays array is required');
      }

      const docs = holidays.map((h) => ({
        name:        h.name,
        date:        new Date(h.date),
        type:        h.type        || 'national',
        description: h.description || '',
        branch:      h.branch      || null,
      }));

      // insertMany with ordered:false so one duplicate doesn't abort the rest
      const result = await Holiday.insertMany(docs, {
        ordered:         false,
        runValidators:   true,
      });

      res.status(201).json(
        new ApiResponse(201, { inserted: result.length }, `${result.length} holidays created`)
      );
    } catch (error) {
      // Partial success — some inserted, some were duplicates
      if (error.insertedDocs) {
        return res.status(207).json(
          new ApiResponse(207, { inserted: error.insertedDocs.length }, 'Some holidays already existed and were skipped')
        );
      }
      next(error);
    }
  },
};
