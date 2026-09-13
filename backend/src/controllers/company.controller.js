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
    if (req.user.role !== "super_admin") {
      throw new ApiError(403, "Access denied");
    }

    // =====================================================
    // 1. GET REQUEST BODY
    // =====================================================

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
      branchCode,
      trackingMode,
      employeeLimit,

      // ===================================================
      // PAYROLL WORKING DAYS CONFIGURATION
      // ===================================================
      workingDaysPerWeek,
      weekOffDays
    } = req.body;

    // =====================================================
    // 2. VALIDATE REQUIRED FIELDS
    // =====================================================

    if (!name || !code || !email) {
      throw new ApiError(
        400,
        "Name, code, and email are required"
      );
    }

    // =====================================================
    // 3. VALIDATE EMPLOYEE LIMIT
    // =====================================================

    const parsedEmployeeLimit =
      employeeLimit !== undefined &&
      employeeLimit !== null &&
      employeeLimit !== ""
        ? parseInt(employeeLimit, 10)
        : 10;

    if (
      isNaN(parsedEmployeeLimit) ||
      parsedEmployeeLimit < 0
    ) {
      throw new ApiError(
        400,
        "Employee limit must be a valid number greater than or equal to 0"
      );
    }

    // =====================================================
    // 4. VALIDATE WORKING DAYS CONFIGURATION
    // =====================================================

    const parsedWorkingDaysPerWeek =
      workingDaysPerWeek !== undefined &&
      workingDaysPerWeek !== null &&
      workingDaysPerWeek !== ""
        ? parseInt(workingDaysPerWeek, 10)
        : 6;

    if (
      isNaN(parsedWorkingDaysPerWeek) ||
      parsedWorkingDaysPerWeek < 1 ||
      parsedWorkingDaysPerWeek > 7
    ) {
      throw new ApiError(
        400,
        "Working days per week must be between 1 and 7"
      );
    }

    // =====================================================
    // 5. VALIDATE WEEK OFF DAYS
    // =====================================================

    const allowedWeekDays = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday"
    ];

    let parsedWeekOffDays;

    if (
      Array.isArray(weekOffDays) &&
      weekOffDays.length > 0
    ) {
      parsedWeekOffDays = weekOffDays.map((day) =>
        String(day).trim().toLowerCase()
      );
    } else {
      // Default company = Sunday off
      parsedWeekOffDays = ["sunday"];
    }

    // Remove duplicate days
    parsedWeekOffDays = [...new Set(parsedWeekOffDays)];

    // Check invalid days
    const invalidWeekOffDays =
      parsedWeekOffDays.filter(
        (day) => !allowedWeekDays.includes(day)
      );

    if (invalidWeekOffDays.length > 0) {
      throw new ApiError(
        400,
        `Invalid week off days: ${invalidWeekOffDays.join(", ")}`
      );
    }

    // =====================================================
    // 6. VALIDATE WORKING DAYS VS WEEK OFF DAYS
    // =====================================================

    const calculatedWorkingDays =
      7 - parsedWeekOffDays.length;

    if (
      calculatedWorkingDays !==
      parsedWorkingDaysPerWeek
    ) {
      throw new ApiError(
        400,
        `Working days per week (${parsedWorkingDaysPerWeek}) does not match week off days. ` +
          `For ${parsedWorkingDaysPerWeek} working days, ` +
          `you should provide ${7 - parsedWorkingDaysPerWeek} week off day(s).`
      );
    }

    // =====================================================
    // 7. RESOLVE TRACKING MODE
    // =====================================================

    // "office"   => office location enabled
    // "tracking" => employee tracking enabled

    const officeLocationEnabled =
      trackingMode !== "tracking";

    const employeeTrackingEnabled =
      trackingMode === "tracking";

    // =====================================================
    // 8. CHECK COMPANY CODE / EMAIL
    // =====================================================

    const existingCompany = await Company.findOne({
      where: {
        [Op.or]: [
          { code },
          { email }
        ]
      }
    });

    if (existingCompany) {
      throw new ApiError(
        400,
        "Company with this code or email already exists"
      );
    }

    // =====================================================
    // 9. CHECK ADMIN EMAIL
    // =====================================================

    const finalAdminEmail =
      adminEmail || email;

    const existingAdmin = await User.findOne({
      where: {
        email: finalAdminEmail
      }
    });

    if (existingAdmin) {
      throw new ApiError(
        400,
        "Admin email is already registered"
      );
    }

    // =====================================================
    // 10. START TRANSACTION
    // =====================================================

    const result = await sequelize.transaction(
      async (t) => {

        // =================================================
        // 10.1 CREATE COMPANY
        // =================================================

        const company = await Company.create(
          {
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

            office_location_enabled:
              officeLocationEnabled,

            employee_tracking_enabled:
              employeeTrackingEnabled,

            // =============================================
            // EMPLOYEE LIMIT
            // =============================================

            employee_limit:
              parsedEmployeeLimit,

            // Company admin is NOT counted
            current_employee_count: 0,

            // =============================================
            // PAYROLL WORKING DAYS
            // =============================================

            working_days_per_week:
              parsedWorkingDaysPerWeek,

            week_off_days:
              parsedWeekOffDays,

            // =============================================
            // STATUS
            // =============================================

            is_active: true,
            is_deleted: false,

            created_by: req.user.id,
            updated_by: req.user.id
          },
          {
            transaction: t
          }
        );

        // =================================================
        // 10.2 CREATE COMPANY ADMIN USER
        // =================================================

        const adminUser = await User.create(
          {
            company_id: company.id,

            name:
              adminName ||
              "Company Admin",

            email:
              finalAdminEmail,

            password:
              adminPassword ||
              "Admin@123",

            role: "company_admin",

            is_active: true,
            is_deleted: false,

            created_by: req.user.id,
            updated_by: req.user.id
          },
          {
            transaction: t
          }
        );

        // =================================================
        // 10.3 CREATE DEFAULT BRANCH
        // =================================================

        const branch = await Branch.create(
          {
            company_id: company.id,

            name:
              branchName ||
              "Head Office",

            code:
              branchCode ||
              "HO001",

            address:
              address || null,

            city:
              city || null,

            state:
              state || null,

            pincode:
              pincode || null,

            phone:
              phone || null,

            email:
              email || null,

            is_active: true,
            is_deleted: false,

            // =============================================
            // GEOFENCE
            // =============================================

            geofence_enabled: false,

            geofence_latitude: null,

            geofence_longitude: null,

            geofence_radius_meters: 100,

            geofence_address:
              address || null,

            created_by: req.user.id,
            updated_by: req.user.id
          },
          {
            transaction: t
          }
        );

        // =================================================
        // 10.4 GENERATE EMPLOYEE CODE
        // =================================================

        const employeeCode =
          await generateEmployeeCode(
            company.id
          );

        // =================================================
        // 10.5 CREATE ADMIN EMPLOYEE RECORD
        // =================================================

        const employee =
          await Employee.create(
            {
              company_id: company.id,

              user_id: adminUser.id,

              branch_id: branch.id,

              employee_code:
                employeeCode,

              name:
                adminName ||
                "Company Admin",

              email:
                finalAdminEmail,

              phone:
                phone || null,

              department:
                "Administration",

              designation:
                "Company Administrator",

              date_of_joining:
                new Date(),

              is_active: true,
              is_deleted: false,

              // ===========================================
              // SALARY
              // ===========================================

              salary_basic: 0,
              salary_hra: 0,
              salary_da: 0,
              salary_ta: 0,
              salary_other: 0,

              // ===========================================
              // WORK TIMING
              // ===========================================

              work_start_hour: 9,

              work_start_minute: 30,

              late_threshold_minutes: 15
            },
            {
              transaction: t
            }
          );

        // =================================================
        // IMPORTANT:
        // DO NOT INCREMENT current_employee_count
        //
        // This employee is the company admin.
        // =================================================

        // =================================================
        // 10.6 UPDATE BRANCH MANAGER
        // =================================================

        await branch.update(
          {
            manager_id: employee.id
          },
          {
            transaction: t
          }
        );

        // =================================================
        // 10.7 CREATE DEFAULT COMPANY SETTINGS
        // =================================================

        try {

          if (CompanySetting) {

            const settings = [
              {
                setting_key:
                  "office_start_time",

                setting_value:
                  "09:30",

                data_type:
                  "string"
              },

              {
                setting_key:
                  "office_end_time",

                setting_value:
                  "18:30",

                data_type:
                  "string"
              },

              {
                setting_key:
                  "late_threshold_minutes",

                setting_value:
                  "15",

                data_type:
                  "integer"
              },

              {
                setting_key:
                  "pf_rate",

                setting_value:
                  "0.12",

                data_type:
                  "string"
              },

              {
                setting_key:
                  "esic_rate",

                setting_value:
                  "0.0075",

                data_type:
                  "string"
              },

              {
                setting_key:
                  "pt_monthly",

                setting_value:
                  "200",

                data_type:
                  "integer"
              },

              {
                setting_key:
                  "default_work_hours",

                setting_value:
                  "9",

                data_type:
                  "integer"
              },

              // ===========================================
              // PAYROLL WORKING DAYS SETTINGS
              // ===========================================

              {
                setting_key:
                  "working_days_per_week",

                setting_value:
                  String(
                    parsedWorkingDaysPerWeek
                  ),

                data_type:
                  "integer"
              },

              {
                setting_key:
                  "week_off_days",

                setting_value:
                  JSON.stringify(
                    parsedWeekOffDays
                  ),

                data_type:
                  "json"
              }
            ];

            for (const setting of settings) {

              await CompanySetting.create(
                {
                  company_id:
                    company.id,

                  setting_key:
                    setting.setting_key,

                  setting_value:
                    setting.setting_value,

                  data_type:
                    setting.data_type
                },
                {
                  transaction: t
                }
              );

            }
          }

        } catch (settingError) {

          console.warn(
            "Could not create company settings:",
            settingError.message
          );

          // Non-fatal
        }

        // =================================================
        // RETURN CREATED DATA
        // =================================================

        return {
          company,
          adminUser,
          branch,
          employee
        };
      }
    );

    // =====================================================
    // 11. GET COMPLETE COMPANY DETAILS
    // =====================================================

    const company = await Company.findByPk(
      result.company.id,
      {
        include: [
          {
            model: User,
            as: "users",

            where: {
              role: "company_admin",
              is_deleted: false
            },

            attributes: [
              "id",
              "name",
              "email",
              "role",
              "is_active"
            ],

            required: false
          },

          {
            model: Branch,
            as: "branches",

            where: {
              is_active: true,
              is_deleted: false
            },

            required: false,

            attributes: [
              "id",
              "name",
              "code",
              "address",
              "city",
              "state",
              "pincode",
              "phone",
              "email",
              "geofence_enabled",
              "geofence_latitude",
              "geofence_longitude",
              "geofence_radius_meters",
              "geofence_address"
            ]
          },

          {
            model: Employee,
            as: "employees",

            where: {
              is_active: true,
              is_deleted: false
            },

            required: false,

            attributes: [
              "id",
              "name",
              "employee_code",
              "designation",
              "department",
              "branch_id"
            ]
          }
        ]
      }
    );

    // =====================================================
    // 12. RESPONSE
    // =====================================================

    res.status(201).json(
      new ApiResponse(
        201,
        {
          company,

          employeeLimit: {
            total:
              result.company.employee_limit,

            current:
              result.company.current_employee_count,

            remaining:
              result.company.employee_limit -
              result.company.current_employee_count
          },

          // =============================================
          // PAYROLL CONFIGURATION IN RESPONSE
          // =============================================

          payrollConfiguration: {
            workingDaysPerWeek:
              result.company
                .working_days_per_week,

            weekOffDays:
              result.company
                .week_off_days
          },

          credentials: {
            adminEmail:
              result.adminUser.email,

            adminPassword:
              adminPassword ||
              "Admin@123",

            adminRole:
              "company_admin"
          },

          branch:
            result.branch,

          employee:
            result.employee
        },

        "Company created successfully with admin user"
      )
    );

  } catch (error) {

    console.error(
      "❌ Create Company Error:",
      error
    );

    next(error);
  }
},

updateCompany: async (req, res, next) => {
  try {
    // =====================================================
    // 1. ACCESS CHECK
    // =====================================================

    if (req.user.role !== "super_admin") {
      throw new ApiError(403, "Access denied");
    }

    // =====================================================
    // 2. GET COMPANY ID
    // =====================================================

    const companyId = parseInt(req.params.id, 10);

    if (!companyId || isNaN(companyId)) {
      throw new ApiError(
        400,
        "Valid company ID is required"
      );
    }

    // =====================================================
    // 3. GET REQUEST BODY
    // =====================================================

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
      pfCode,
      esicCode,
      logo,
      website,
      trackingMode,
      employeeLimit,

      // ===================================================
      // PAYROLL CONFIGURATION
      // ===================================================

      workingDaysPerWeek,
      weekOffDays
    } = req.body;

    // =====================================================
    // 4. FIND COMPANY
    // =====================================================

    const company = await Company.findByPk(
      companyId
    );

    if (!company) {
      throw new ApiError(
        404,
        "Company not found"
      );
    }

    // =====================================================
    // 5. VALIDATE COMPANY NAME
    // =====================================================

    if (
      name !== undefined &&
      (!name || String(name).trim() === "")
    ) {
      throw new ApiError(
        400,
        "Company name cannot be empty"
      );
    }

    // =====================================================
    // 6. CHECK DUPLICATE COMPANY CODE
    // =====================================================

    if (
      code !== undefined &&
      code !== company.code
    ) {
      const existingCode =
        await Company.findOne({
          where: {
            code,
            id: {
              [Op.ne]: companyId
            }
          }
        });

      if (existingCode) {
        throw new ApiError(
          400,
          "Company code already exists"
        );
      }
    }

    // =====================================================
    // 7. CHECK DUPLICATE COMPANY EMAIL
    // =====================================================

    if (
      email !== undefined &&
      email !== company.email
    ) {
      const existingEmail =
        await Company.findOne({
          where: {
            email,
            id: {
              [Op.ne]: companyId
            }
          }
        });

      if (existingEmail) {
        throw new ApiError(
          400,
          "Company email already exists"
        );
      }
    }

    // =====================================================
    // 8. VALIDATE EMPLOYEE LIMIT
    // =====================================================

    let parsedEmployeeLimit =
      company.employee_limit;

    if (
      employeeLimit !== undefined &&
      employeeLimit !== null &&
      employeeLimit !== ""
    ) {
      parsedEmployeeLimit =
        parseInt(employeeLimit, 10);

      if (
        isNaN(parsedEmployeeLimit) ||
        parsedEmployeeLimit < 0
      ) {
        throw new ApiError(
          400,
          "Employee limit must be a valid number greater than or equal to 0"
        );
      }
    }

    // =====================================================
    // 9. CHECK CURRENT EMPLOYEE COUNT
    // =====================================================

    const currentEmployeeCount =
      parseInt(
        company.current_employee_count || 0,
        10
      );

    if (
      parsedEmployeeLimit <
      currentEmployeeCount
    ) {
      throw new ApiError(
        400,
        `Employee limit cannot be less than current employee count (${currentEmployeeCount})`
      );
    }

    // =====================================================
    // 10. WORKING DAYS CONFIGURATION
    // =====================================================

    let parsedWorkingDaysPerWeek =
      company.working_days_per_week || 6;

    // If user sends workingDaysPerWeek,
    // use new value.
    if (
      workingDaysPerWeek !== undefined &&
      workingDaysPerWeek !== null &&
      workingDaysPerWeek !== ""
    ) {
      parsedWorkingDaysPerWeek =
        parseInt(
          workingDaysPerWeek,
          10
        );
    }

    if (
      isNaN(parsedWorkingDaysPerWeek) ||
      parsedWorkingDaysPerWeek < 1 ||
      parsedWorkingDaysPerWeek > 7
    ) {
      throw new ApiError(
        400,
        "Working days per week must be between 1 and 7"
      );
    }

    // =====================================================
    // 11. WEEK OFF DAYS
    // =====================================================

    let parsedWeekOffDays =
      company.week_off_days;

    // JSON column may return an array
    // or a JSON string depending on configuration.

    if (
      typeof parsedWeekOffDays === "string"
    ) {
      try {
        parsedWeekOffDays =
          JSON.parse(
            parsedWeekOffDays
          );
      } catch (error) {
        parsedWeekOffDays = [
          "sunday"
        ];
      }
    }

    if (
      !Array.isArray(parsedWeekOffDays)
    ) {
      parsedWeekOffDays = [
        "sunday"
      ];
    }

    // =====================================================
    // 12. IF WEEK OFF DAYS ARE PROVIDED,
    //     USE THE NEW VALUE
    // =====================================================

    if (
      weekOffDays !== undefined
    ) {
      if (
        !Array.isArray(weekOffDays)
      ) {
        throw new ApiError(
          400,
          "weekOffDays must be an array"
        );
      }

      if (
        weekOffDays.length === 0
      ) {
        throw new ApiError(
          400,
          "At least one week off day is required"
        );
      }

      parsedWeekOffDays =
        weekOffDays.map(
          (day) =>
            String(day)
              .trim()
              .toLowerCase()
        );
    }

    // =====================================================
    // 13. REMOVE DUPLICATE WEEK OFF DAYS
    // =====================================================

    parsedWeekOffDays =
      [
        ...new Set(
          parsedWeekOffDays
        )
      ];

    // =====================================================
    // 14. VALID WEEK DAYS
    // =====================================================

    const allowedWeekDays = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday"
    ];

    // =====================================================
    // 15. CHECK INVALID WEEK OFF DAYS
    // =====================================================

    const invalidWeekOffDays =
      parsedWeekOffDays.filter(
        (day) =>
          !allowedWeekDays.includes(
            day
          )
      );

    if (
      invalidWeekOffDays.length > 0
    ) {
      throw new ApiError(
        400,
        `Invalid week off days: ${invalidWeekOffDays.join(", ")}`
      );
    }

    // =====================================================
    // 16. VALIDATE WORKING DAYS
    //     AGAINST WEEK OFF DAYS
    // =====================================================

    const calculatedWorkingDays =
      7 -
      parsedWeekOffDays.length;

    if (
      calculatedWorkingDays !==
      parsedWorkingDaysPerWeek
    ) {
      throw new ApiError(
        400,
        `Working days per week (${parsedWorkingDaysPerWeek}) does not match week off days. ` +
        `For ${parsedWorkingDaysPerWeek} working days, ` +
        `you need ${7 - parsedWorkingDaysPerWeek} week off day(s).`
      );
    }

    // =====================================================
    // 17. TRACKING MODE
    // =====================================================

    let officeLocationEnabled =
      company.office_location_enabled;

    let employeeTrackingEnabled =
      company.employee_tracking_enabled;

    if (
      trackingMode !== undefined
    ) {
      officeLocationEnabled =
        trackingMode !== "tracking";

      employeeTrackingEnabled =
        trackingMode === "tracking";
    }

    // =====================================================
    // 18. UPDATE COMPANY
    // =====================================================

    await company.update({
      name:
        name !== undefined
          ? name
          : company.name,

      code:
        code !== undefined
          ? code
          : company.code,

      email:
        email !== undefined
          ? email
          : company.email,

      phone:
        phone !== undefined
          ? phone
          : company.phone,

      address:
        address !== undefined
          ? address
          : company.address,

      city:
        city !== undefined
          ? city
          : company.city,

      state:
        state !== undefined
          ? state
          : company.state,

      pincode:
        pincode !== undefined
          ? pincode
          : company.pincode,

      gst_number:
        gstNumber !== undefined
          ? gstNumber
          : company.gst_number,

      pan_number:
        panNumber !== undefined
          ? panNumber
          : company.pan_number,

      pf_code:
        pfCode !== undefined
          ? pfCode
          : company.pf_code,

      esic_code:
        esicCode !== undefined
          ? esicCode
          : company.esic_code,

      logo:
        logo !== undefined
          ? logo
          : company.logo,

      website:
        website !== undefined
          ? website
          : company.website,

      // ===================================================
      // TRACKING
      // ===================================================

      office_location_enabled:
        officeLocationEnabled,

      employee_tracking_enabled:
        employeeTrackingEnabled,

      // ===================================================
      // EMPLOYEE LIMIT
      // ===================================================

      employee_limit:
        parsedEmployeeLimit,

      // ===================================================
      // PAYROLL CONFIGURATION
      // ===================================================

      working_days_per_week:
        parsedWorkingDaysPerWeek,

      week_off_days:
        parsedWeekOffDays,

      // ===================================================
      // AUDIT
      // ===================================================

      updated_by:
        req.user.id
    });

    // =====================================================
    // 19. UPDATE COMPANY SETTINGS
    // =====================================================

    try {

      if (CompanySetting) {

        // -----------------------------------------------
        // WORKING DAYS PER WEEK
        // -----------------------------------------------

        const workingDaysSetting =
          await CompanySetting.findOne({
            where: {
              company_id:
                companyId,

              setting_key:
                "working_days_per_week"
            }
          });

        if (workingDaysSetting) {

          await workingDaysSetting.update({
            setting_value:
              String(
                parsedWorkingDaysPerWeek
              ),

            data_type:
              "integer"
          });

        } else {

          await CompanySetting.create({
            company_id:
              companyId,

            setting_key:
              "working_days_per_week",

            setting_value:
              String(
                parsedWorkingDaysPerWeek
              ),

            data_type:
              "integer"
          });

        }

        // -----------------------------------------------
        // WEEK OFF DAYS
        // -----------------------------------------------

        const weekOffSetting =
          await CompanySetting.findOne({
            where: {
              company_id:
                companyId,

              setting_key:
                "week_off_days"
            }
          });

        if (weekOffSetting) {

          await weekOffSetting.update({
            setting_value:
              JSON.stringify(
                parsedWeekOffDays
              ),

            data_type:
              "json"
          });

        } else {

          await CompanySetting.create({
            company_id:
              companyId,

            setting_key:
              "week_off_days",

            setting_value:
              JSON.stringify(
                parsedWeekOffDays
              ),

            data_type:
              "json"
          });

        }
      }

    } catch (settingError) {

      console.warn(
        "Could not update company payroll settings:",
        settingError.message
      );

      // Settings failure should not
      // rollback company update.
    }

    // =====================================================
    // 20. FETCH UPDATED COMPANY
    // =====================================================

    const updatedCompany =
      await Company.findByPk(
        companyId,
        {
          include: [
            {
              model: User,
              as: "users",

              where: {
                role: "company_admin",
                is_deleted: false
              },

              attributes: [
                "id",
                "name",
                "email",
                "role",
                "is_active"
              ],

              required: false
            },

            {
              model: Branch,
              as: "branches",

              where: {
                is_active: true,
                is_deleted: false
              },

              required: false,

              attributes: [
                "id",
                "name",
                "code",
                "address",
                "city",
                "state",
                "pincode",
                "phone",
                "email",
                "geofence_enabled",
                "geofence_latitude",
                "geofence_longitude",
                "geofence_radius_meters",
                "geofence_address"
              ]
            },

            {
              model: Employee,
              as: "employees",

              where: {
                is_active: true,
                is_deleted: false
              },

              required: false,

              attributes: [
                "id",
                "name",
                "employee_code",
                "designation",
                "department",
                "branch_id"
              ]
            }
          ]
        }
      );

    // =====================================================
    // 21. RESPONSE
    // =====================================================

    res.status(200).json(
      new ApiResponse(
        200,
        {
          company:
            updatedCompany,

          employeeLimit: {
            total:
              updatedCompany.employee_limit,

            current:
              updatedCompany.current_employee_count,

            remaining:
              updatedCompany.employee_limit -
              updatedCompany.current_employee_count
          },

          payrollConfiguration: {
            workingDaysPerWeek:
              updatedCompany
                .working_days_per_week,

            weekOffDays:
              updatedCompany
                .week_off_days
          }
        },

        "Company updated successfully"
      )
    );

  } catch (error) {

    console.error(
      "❌ Update Company Error:",
      error
    );

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
            as: 'company_settings'
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

updateLogo: async (req, res, next) => {

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

updateEmployeeTracking: async (req, res, next) => {
  try {
    const { id } = req.params;
    const { employeeTrackingEnabled } = req.body;

    if (employeeTrackingEnabled === undefined) {
      throw new ApiError(
        400,
        "employeeTrackingEnabled is required"
      );
    }

    if (typeof employeeTrackingEnabled !== "boolean") {
      throw new ApiError(
        400,
        "employeeTrackingEnabled must be a boolean"
      );
    }

    const company = await Company.findByPk(id);

    if (!company) {
      throw new ApiError(404, "Company not found");
    }

    await company.update({
      employee_tracking_enabled: employeeTrackingEnabled,
      updated_by: req.user.id
    });

    res.json(
      new ApiResponse(
        200,
        {
          id: company.id,
          employee_tracking_enabled:
            company.employee_tracking_enabled
        },
        "Employee tracking setting updated successfully"
      )
    );
  } catch (error) {
    next(error);
  }
},

updateEmployeeLimit: async (req, res, next) => {
  try {
    const { id } = req.params;
    const { employeeLimit } = req.body;

    if (employeeLimit === undefined) {
      throw new ApiError(
        400,
        "employeeLimit is required"
      );
    }

    const parsedLimit = parseInt(employeeLimit, 10);

    if (
      isNaN(parsedLimit) ||
      parsedLimit < 0
    ) {
      throw new ApiError(
        400,
        "employeeLimit must be a valid number greater than or equal to 0"
      );
    }

    const company = await Company.findByPk(id);

    if (!company) {
      throw new ApiError(404, "Company not found");
    }

    // Don't allow limit below current employee count
    if (
      parsedLimit < company.current_employee_count
    ) {
      throw new ApiError(
        400,
        `Employee limit cannot be less than current employee count (${company.current_employee_count})`
      );
    }

    await company.update({
      employee_limit: parsedLimit,
      updated_by: req.user.id
    });

    res.json(
      new ApiResponse(
        200,
        {
          id: company.id,
          employee_limit: company.employee_limit,
          current_employee_count:
            company.current_employee_count,
          remaining:
            company.employee_limit -
            company.current_employee_count
        },
        "Employee limit updated successfully"
      )
    );
  } catch (error) {
    next(error);
  }
},

updateOfficeLocation: async (req, res, next) => {
  try {
    const { id } = req.params;
    const { officeLocationEnabled } = req.body;

    if (officeLocationEnabled === undefined) {
      throw new ApiError(
        400,
        "officeLocationEnabled is required"
      );
    }

    if (typeof officeLocationEnabled !== "boolean") {
      throw new ApiError(
        400,
        "officeLocationEnabled must be a boolean"
      );
    }

    const company = await Company.findByPk(id);

    if (!company) {
      throw new ApiError(404, "Company not found");
    }

    await company.update({
      office_location_enabled:
        officeLocationEnabled,
      updated_by: req.user.id
    });

    res.json(
      new ApiResponse(
        200,
        {
          id: company.id,
          office_location_enabled:
            company.office_location_enabled
        },
        "Office location setting updated successfully"
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