// controllers/company.controller.js - FIXED

const { Company, User, Employee, Branch, CompanySetting, sequelize } = require('../models');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { Op } = require('sequelize');

// ✅ Helper: Generate unique employee code
const generateEmployeeCode = async (companyId) => {
  const lastEmployee = await Employee.findOne({
    where: { company_id: companyId },
    order: [['id', 'DESC']],
    attributes: ['employee_code']
  });

  if (!lastEmployee || !lastEmployee.employee_code) {
    return `EMP-${String(companyId).padStart(3, '0')}-001`;
  }

  const lastCode = lastEmployee.employee_code;
  const parts = lastCode.split('-');
  const lastNum = parseInt(parts[parts.length - 1], 10);
  
  if (isNaN(lastNum)) {
    return `EMP-${String(companyId).padStart(3, '0')}-001`;
  }
  
  const nextNum = lastNum + 1;
  return `EMP-${String(companyId).padStart(3, '0')}-${String(nextNum).padStart(3, '0')}`;
};

module.exports = {
  // @route POST /api/v1/companies
  // @desc Create a new company with default settings
  createCompany: async (req, res, next) => {
    try {
      const {
        name,
        code,
        email,
        phone,
        address,
        city,
        state,
        pincode,
        gstNumber,
        panNumber,
        adminName,
        adminEmail,
        adminPassword,
        branchName,
        branchCode
      } = req.body;

      // Validate required fields
      if (!name || !code || !email) {
        throw new ApiError(400, 'Name, code, and email are required');
      }

      // Check if company code already exists
      const existingCompany = await Company.findOne({
        where: { [Op.or]: [{ code }, { email }] }
      });

      if (existingCompany) {
        throw new ApiError(400, 'Company with this code or email already exists');
      }

      // Start transaction
      const result = await sequelize.transaction(async (t) => {
        // 1. Create company
        const company = await Company.create({
          name,
          code,
          email,
          phone: phone || null,
          address: address || null,
          city: city || null,
          state: state || null,
          pincode: pincode || null,
          gst_number: gstNumber || null,
          pan_number: panNumber || null,
          is_active: true
        }, { transaction: t });

        // 2. Create company admin user
        const adminUser = await User.create({
          company_id: company.id,
          name: adminName || 'Company Admin',
          email: adminEmail || email,
          password: adminPassword || 'Admin@123',
          role: 'company_admin',
          is_active: true
        }, { transaction: t });

        // 3. Create default branch
        const branch = await Branch.create({
          company_id: company.id,
          name: branchName || 'Head Office',
          code: branchCode || 'HO001',
          address: address || null,
          city: city || null,
          state: state || null,
          pincode: pincode || null,
          phone: phone || null,
          email: email || null,
          is_active: true,
          geofence_enabled: false,
          geofence_radius_meters: 100
        }, { transaction: t });

        // ✅ 4. Generate unique employee code
        const employeeCode = await generateEmployeeCode(company.id);

        // 5. Create admin employee record
        const employee = await Employee.create({
          company_id: company.id,
          user_id: adminUser.id,
          branch_id: branch.id,
          employee_code: employeeCode, // ✅ Use generated unique code
          name: adminName || 'Company Admin',
          email: adminEmail || email,
          phone: phone || null,
          department: 'Administration',
          designation: 'Company Administrator',
          date_of_joining: new Date(),
          is_active: true,
          salary_basic: 0,
          salary_hra: 0,
          salary_da: 0,
          salary_ta: 0,
          work_start_hour: 9,
          work_start_minute: 30,
          late_threshold_minutes: 15
        }, { transaction: t });

        // 6. Update branch with manager
        await branch.update({
          manager_id: employee.id
        }, { transaction: t });

        // 7. Create default company settings (using model if available)
        try {
          if (CompanySetting) {
            const settings = [
              { setting_key: 'office_start_time', setting_value: '09:30', data_type: 'string' },
              { setting_key: 'office_end_time', setting_value: '18:30', data_type: 'string' },
              { setting_key: 'late_threshold_minutes', setting_value: '15', data_type: 'integer' },
              { setting_key: 'pf_rate', setting_value: '0.12', data_type: 'string' },
              { setting_key: 'esic_rate', setting_value: '0.0075', data_type: 'string' },
              { setting_key: 'pt_monthly', setting_value: '200', data_type: 'integer' },
              { setting_key: 'default_work_hours', setting_value: '9', data_type: 'integer' }
            ];

            for (const setting of settings) {
              await CompanySetting.create({
                company_id: company.id,
                setting_key: setting.setting_key,
                setting_value: setting.setting_value,
                data_type: setting.data_type
              }, { transaction: t });
            }
          }
        } catch (settingError) {
          console.warn('Could not create company settings:', settingError.message);
          // Non-fatal - continue
        }

        return { company, adminUser, branch, employee };
      });

      // Get complete company details
      const company = await Company.findByPk(result.company.id, {
        include: [
          {
            model: User,
            as: 'users',
            where: { role: 'company_admin' },
            attributes: ['id', 'name', 'email', 'role'],
            required: false
          },
          {
            model: Branch,
            as: 'branches',
            where: { is_active: true },
            required: false,
            attributes: ['id', 'name', 'code']
          },
          {
            model: Employee,
            as: 'employees',
            where: { is_active: true },
            required: false,
            attributes: ['id', 'name', 'employee_code', 'designation'],
            limit: 1
          }
        ]
      });

      res.status(201).json(new ApiResponse(201, {
        company,
        credentials: {
          adminEmail: result.adminUser.email,
          adminPassword: adminPassword || 'Admin@123',
          adminRole: 'company_admin'
        },
        branch: result.branch,
        employee: result.employee
      }, 'Company created successfully with admin user'));
    } catch (error) {
      console.error('❌ Create Company Error:', error);
      next(error);
    }
  },

  // ... rest of the controller functions remain the same

  // @route POST /api/v1/companies/:companyId/admins
  // @desc Create a new admin for an existing company
  createCompanyAdmin: async (req, res, next) => {
  try {
    const { companyId } = req.params;

    const {
      name,
      email,
      password,
      role = "company_admin",
      office_location_enabled = true,
      employee_tracking_enabled = false
    } = req.body;

    // Check if company exists
    const company = await Company.findByPk(companyId);

    if (!company) {
      throw new ApiError(404, "Company not found");
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: { email }
    });

    if (existingUser) {
      throw new ApiError(400, "User with this email already exists");
    }

    // Update company settings
    await company.update({
      office_location_enabled,
      employee_tracking_enabled
    });

    // Create admin user
    const user = await User.create({
      company_id: companyId,
      name: name || "Admin User",
      email,
      password: password || "Admin@123",
      role,
      is_active: true
    });

    // Find first active branch
    const branch = await Branch.findOne({
      where: {
        company_id: companyId,
        is_active: true
      },
      order: [["id", "ASC"]]
    });

    // Create employee record for admin
    if (branch) {
      await Employee.create({
        company_id: companyId,
        user_id: user.id,
        branch_id: branch.id,

        employee_code: `EMP${String(
          (await Employee.count({
            where: { company_id: companyId }
          })) + 1
        ).padStart(3, "0")}`,

        name: user.name,
        email: user.email,
        department: "Administration",
        designation: "Administrator",
        date_of_joining: new Date(),

        is_active: true,

        salary_basic: 0,
        salary_hra: 0,
        salary_da: 0,
        salary_ta: 0,

        work_start_hour: 9,
        work_start_minute: 30,
        late_threshold_minutes: 15
      });
    }

    // Get admin without password
    const adminUser = await User.findByPk(user.id, {
      attributes: {
        exclude: ["password"]
      }
    });

    // Get updated company
    const updatedCompany = await Company.findByPk(companyId);

    res.status(201).json(
      new ApiResponse(
        201,
        {
          user: adminUser,

          company: updatedCompany,

          settings: {
            office_location_enabled:
              updatedCompany.office_location_enabled,

            employee_tracking_enabled:
              updatedCompany.employee_tracking_enabled
          },

          credentials: {
            email,
            password: password || "Admin@123"
          }
        },
        "Company admin created successfully"
      )
    );
  } catch (error) {
    next(error);
  }
},

  // @route GET /api/v1/companies
  // @desc Get all companies
  getCompanies: async (req, res, next) => {
    try {
      const { search, isActive, page = 1, limit = 20 } = req.query;

      const where = {};
      const offset = (page - 1) * limit;

      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { code: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } }
        ];
      }

      if (isActive !== undefined) {
        where.is_active = isActive === 'true';
      }

      const { count, rows: companies } = await Company.findAndCountAll({
        where,
        attributes: {
          include: [
            [
              sequelize.literal(`(
                SELECT COUNT(*) FROM users 
                WHERE users.company_id = Company.id 
                AND users.role = 'company_admin'
              )`),
              'admin_count'
            ],
            [
              sequelize.literal(`(
                SELECT COUNT(*) FROM employees 
                WHERE employees.company_id = Company.id 
                AND employees.is_active = TRUE
              )`),
              'employee_count'
            ],
            [
              sequelize.literal(`(
                SELECT COUNT(*) FROM branches 
                WHERE branches.company_id = Company.id 
                AND branches.is_active = TRUE
              )`),
              'branch_count'
            ]
          ]
        },
        include: [
          {
            model: User,
            as: 'users',
            where: { role: 'company_admin' },
            attributes: ['id', 'name', 'email'],
            required: false,
            limit: 1
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      });

      res.json(new ApiResponse(200, {
        companies,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }));
    } catch (error) {
      next(error);
    }
  },

  // @route GET /api/v1/companies/:id
  // @desc Get company by ID with all details
  getCompanyById: async (req, res, next) => {
    try {
      const { id } = req.params;

      const company = await Company.findByPk(id, {
        include: [
          {
            model: User,
            as: 'users',
            attributes: { exclude: ['password'] }
          },
          {
            model: Branch,
            as: 'branches',
            where: { is_active: true },
            required: false,
            include: [
              {
                model: Employee,
                as: 'manager',
                attributes: ['id', 'name']
              }
            ]
          },
          {
            model: Employee,
            as: 'employees',
            where: { is_active: true },
            required: false,
            attributes: ['id', 'name', 'employee_code', 'department', 'designation']
          },
          {
            model: CompanySetting,
            as: 'settings'
          }
        ]
      });

      if (!company) {
        throw new ApiError(404, 'Company not found');
      }

      res.json(new ApiResponse(200, company));
    } catch (error) {
      next(error);
    }
  },

  // @route PUT /api/v1/companies/:id
  // @desc Update company details
updateCompany: async (req, res, next) => {
  try {
    const { id } = req.params;

    const {
      name,
      phone,
      address,
      city,
      state,
      pincode,
      gstNumber,
      panNumber,
      pfCode,
      esicCode,
      website
    } = req.body;

    const company = await Company.findByPk(id);

    if (!company) {
      throw new ApiError(404, "Company not found");
    }

    const updateData = {};

    // Company details
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (pincode !== undefined) updateData.pincode = pincode;
    if (gstNumber !== undefined) updateData.gst_number = gstNumber;
    if (panNumber !== undefined) updateData.pan_number = panNumber;
    if (pfCode !== undefined) updateData.pf_code = pfCode;
    if (esicCode !== undefined) updateData.esic_code = esicCode;
    if (website !== undefined) updateData.website = website;

    // ============================================================
    // LOGO
    // ============================================================

    // If logo is uploaded using multer
    if (req.file) {
      updateData.logo = `/uploads/company/${req.file.filename}`;
    }

    // If logo is sent as a URL/string instead
    else if (req.body.logo !== undefined) {
      updateData.logo = req.body.logo;
    }

    // ============================================================
    // UPDATE COMPANY
    // ============================================================

    if (Object.keys(updateData).length === 0) {
      throw new ApiError(400, "No data provided for update");
    }

    await company.update(updateData);

    // ============================================================
    // GET UPDATED COMPANY
    // ============================================================

    const updated = await Company.findByPk(id, {
      include: [
        {
          model: User,
          as: "users",
          where: { role: "company_admin" },
          required: false,
          attributes: {
            exclude: ["password"]
          }
        },
        {
          model: Branch,
          as: "branches",
          where: { is_active: true },
          required: false
        }
      ]
    });

    res.json(
      new ApiResponse(
        200,
        updated,
        "Company updated successfully"
      )
    );
  } catch (error) {
    next(error);
  }
},

  // @route DELETE /api/v1/companies/:id
  // @desc Soft delete company
  deleteCompany: async (req, res, next) => {
    try {
      const { id } = req.params;

      const company = await Company.findByPk(id);
      if (!company) {
        throw new ApiError(404, 'Company not found');
      }

      // Soft delete: deactivate company and all related users/employees
      await sequelize.transaction(async (t) => {
        // Deactivate company
        await company.update({ is_active: false }, { transaction: t });

        // Deactivate all users
        await User.update(
          { is_active: false },
          { where: { company_id: id }, transaction: t }
        );

        // Deactivate all employees
        await Employee.update(
          { is_active: false },
          { where: { company_id: id }, transaction: t }
        );

        // Deactivate all branches
        await Branch.update(
          { is_active: false },
          { where: { company_id: id }, transaction: t }
        );
      });

      res.json(new ApiResponse(200, null, 'Company and all associated records deactivated'));
    } catch (error) {
      next(error);
    }
  },

  // @route PATCH /api/v1/companies/:id/toggle-status
  // @desc Toggle company active status
  toggleCompanyStatus: async (req, res, next) => {
    try {
      const { id } = req.params;

      const company = await Company.findByPk(id);
      if (!company) {
        throw new ApiError(404, 'Company not found');
      }

      await company.update({ is_active: !company.is_active });

      res.json(new ApiResponse(200, {
        id: company.id,
        is_active: company.is_active
      }, `Company ${company.is_active ? 'activated' : 'deactivated'} successfully`));
    } catch (error) {
      next(error);
    }
  },

  // @route GET /api/v1/companies/:companyId/admins
  // @desc Get all admins of a company
  getCompanyAdmins: async (req, res, next) => {
    try {
      const { companyId } = req.params;

      const company = await Company.findByPk(companyId);
      if (!company) {
        throw new ApiError(404, 'Company not found');
      }

      const admins = await User.findAll({
        where: {
          company_id: companyId,
          role: { [Op.in]: ['company_admin', 'hr'] },
          is_active: true
        },
        attributes: { exclude: ['password'] },
        include: [
          {
            model: Employee,
            as: 'employee',
            attributes: ['id', 'employee_code', 'designation', 'department']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      res.json(new ApiResponse(200, admins));
    } catch (error) {
      next(error);
    }
  }
};