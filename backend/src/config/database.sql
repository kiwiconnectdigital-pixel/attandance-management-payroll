-- =============================================
-- MULTI-TENANT ATTENDANCE & PAYROLL SYSTEM
-- MySQL Database Schema
-- =============================================

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS payslips;
DROP TABLE IF EXISTS payrolls;
DROP TABLE IF EXISTS leaves;
DROP TABLE IF EXISTS holidays;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS branches;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS companies;

-- =============================================
-- 1. COMPANIES TABLE (Tenant)
-- =============================================
CREATE TABLE companies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(20),
    gst_number VARCHAR(50),
    pan_number VARCHAR(50),
    pf_code VARCHAR(50),
    esic_code VARCHAR(50),
    logo VARCHAR(255),
    website VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_company_code (code),
    INDEX idx_company_active (is_active)
);

-- =============================================
-- 2. USERS TABLE (Super Admin, Company Admin, Employee)
-- =============================================
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('super_admin', 'company_admin', 'hr', 'employee') NOT NULL DEFAULT 'employee',
    is_active BOOLEAN DEFAULT TRUE,
    last_login DATETIME,
    refresh_token VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_user_email (email),
    INDEX idx_user_company (company_id),
    INDEX idx_user_role (role),
    INDEX idx_user_active (is_active)
);

-- =============================================
-- 3. BRANCHES TABLE
-- =============================================
CREATE TABLE branches (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(20),
    phone VARCHAR(20),
    email VARCHAR(255),
    manager_id INT,
    is_active BOOLEAN DEFAULT TRUE,
    -- Geofence settings
    geofence_enabled BOOLEAN DEFAULT FALSE,
    geofence_latitude DECIMAL(10, 8),
    geofence_longitude DECIMAL(11, 8),
    geofence_radius_meters INT DEFAULT 100,
    geofence_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL,
    UNIQUE KEY uk_branch_company_code (company_id, code),
    INDEX idx_branch_company (company_id),
    INDEX idx_branch_active (is_active)
);

-- =============================================
-- 4. EMPLOYEES TABLE
-- =============================================
CREATE TABLE employees (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    user_id INT UNIQUE,
    branch_id INT,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    department VARCHAR(100),
    designation VARCHAR(100),
    date_of_joining DATE,
    date_of_birth DATE,
    gender ENUM('male', 'female', 'other'),
    address TEXT,
    profile_image VARCHAR(255),
    face_descriptor JSON,  -- Store face descriptor as JSON array
    photo VARCHAR(255),
    
    -- Work Schedule
    work_start_hour INT DEFAULT 9,
    work_start_minute INT DEFAULT 0,
    late_threshold_minutes INT DEFAULT 0,
    
    -- Salary Structure
    salary_basic DECIMAL(10, 2) DEFAULT 0,
    salary_hra DECIMAL(10, 2) DEFAULT 0,
    salary_da DECIMAL(10, 2) DEFAULT 0,
    salary_ta DECIMAL(10, 2) DEFAULT 0,
    salary_other DECIMAL(10, 2) DEFAULT 0,
    
    -- Leave Balances
    leave_balance_cl DECIMAL(5, 1) DEFAULT 12,
    leave_balance_sl DECIMAL(5, 1) DEFAULT 12,
    leave_balance_pl DECIMAL(5, 1) DEFAULT 15,
    
    -- Bank Details
    bank_account_number VARCHAR(50),
    bank_name VARCHAR(255),
    bank_ifsc_code VARCHAR(20),
    
    -- Government IDs
    pan_number VARCHAR(20),
    aadhar_number VARCHAR(20),
    pf_number VARCHAR(50),
    esic_number VARCHAR(50),
    uan_number VARCHAR(50),
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
    
    INDEX idx_employee_company (company_id),
    INDEX idx_employee_branch (branch_id),
    INDEX idx_employee_user (user_id),
    INDEX idx_employee_email (email),
    INDEX idx_employee_code (employee_code),
    INDEX idx_employee_active (is_active)
);

-- =============================================
-- 5. ATTENDANCE TABLE
-- =============================================
CREATE TABLE attendance (
    id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT NOT NULL,
    date DATE NOT NULL,
    status ENUM('present', 'absent', 'half-day', 'on-leave', 'holiday', 'weekend') DEFAULT 'absent',
    working_hours DECIMAL(5, 2) DEFAULT 0,
    overtime_hours DECIMAL(5, 2) DEFAULT 0,
    is_late BOOLEAN DEFAULT FALSE,
    late_by_minutes INT DEFAULT 0,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE KEY uk_attendance_employee_date (employee_id, date),
    INDEX idx_attendance_employee (employee_id),
    INDEX idx_attendance_date (date),
    INDEX idx_attendance_status (status)
);

-- =============================================
-- 6. PUNCHES TABLE (Check-in/Check-out records)
-- =============================================
CREATE TABLE punches (
    id INT PRIMARY KEY AUTO_INCREMENT,
    attendance_id INT NOT NULL,
    type ENUM('check_in', 'check_out') NOT NULL,
    time DATETIME NOT NULL,
    selfie VARCHAR(255),
    branch_id INT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    address TEXT,
    face_match_score DECIMAL(5, 4),
    face_verified BOOLEAN DEFAULT FALSE,
    is_late BOOLEAN DEFAULT FALSE,
    late_by_minutes INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
    INDEX idx_punch_attendance (attendance_id),
    INDEX idx_punch_type_time (type, time)
);

-- =============================================
-- 7. LEAVES TABLE
-- =============================================
CREATE TABLE leaves (
    id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT NOT NULL,
    leave_type ENUM('CL', 'SL', 'PL', 'HD') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days DECIMAL(5, 1) NOT NULL,
    reason TEXT NOT NULL,
    half_day_option ENUM('first_half', 'second_half') DEFAULT NULL,
    status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
    applied_on DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_by INT,
    reviewed_on DATETIME,
    review_remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_leave_employee (employee_id),
    INDEX idx_leave_status (status),
    INDEX idx_leave_dates (start_date, end_date)
);

-- =============================================
-- 8. HOLIDAYS TABLE
-- =============================================
CREATE TABLE holidays (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT,
    branch_id INT,
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    type ENUM('national', 'regional', 'optional', 'company') DEFAULT 'national',
    description TEXT,
    is_weekday BOOLEAN DEFAULT TRUE,
    year INT,
    month INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    UNIQUE KEY uk_holiday_company_branch_date (company_id, branch_id, date),
    INDEX idx_holiday_company (company_id),
    INDEX idx_holiday_branch (branch_id),
    INDEX idx_holiday_date (date),
    INDEX idx_holiday_year_month (year, month)
);

-- =============================================
-- 9. PAYROLLS TABLE
-- =============================================
CREATE TABLE payrolls (
    id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT NOT NULL,
    month INT NOT NULL,
    year INT NOT NULL,
    
    -- Earnings
    earning_basic DECIMAL(10, 2) NOT NULL DEFAULT 0,
    earning_hra DECIMAL(10, 2) DEFAULT 0,
    earning_da DECIMAL(10, 2) DEFAULT 0,
    earning_ta DECIMAL(10, 2) DEFAULT 0,
    earning_overtime DECIMAL(10, 2) DEFAULT 0,
    earning_bonus DECIMAL(10, 2) DEFAULT 0,
    earning_other DECIMAL(10, 2) DEFAULT 0,
    
    -- Deductions
    deduction_esic DECIMAL(10, 2) DEFAULT 0,
    deduction_advance DECIMAL(10, 2) DEFAULT 0,
    deduction_pt DECIMAL(10, 2) DEFAULT 0,
    deduction_tds DECIMAL(10, 2) DEFAULT 0,
    deduction_lop DECIMAL(10, 2) DEFAULT 0,
    deduction_other DECIMAL(10, 2) DEFAULT 0,
    
    -- Summary
    gross_salary DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_deductions DECIMAL(10, 2) NOT NULL DEFAULT 0,
    net_salary DECIMAL(10, 2) NOT NULL DEFAULT 0,
    
    -- Attendance Summary
    att_total_working_days INT DEFAULT 0,
    att_present_days INT DEFAULT 0,
    att_absent_days INT DEFAULT 0,
    att_leave_days INT DEFAULT 0,
    att_overtime_hours DECIMAL(5, 2) DEFAULT 0,
    att_calendar_days INT DEFAULT 0,
    att_weekdays_in_month INT DEFAULT 0,
    att_holiday_count INT DEFAULT 0,
    att_payable_days DECIMAL(5, 2) DEFAULT 0,
    att_half_days INT DEFAULT 0,
    
    status ENUM('draft', 'processed', 'paid') DEFAULT 'draft',
    processed_by INT,
    processed_on DATETIME,
    paid_on DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uk_payroll_employee_month_year (employee_id, month, year),
    INDEX idx_payroll_employee (employee_id),
    INDEX idx_payroll_month_year (month, year),
    INDEX idx_payroll_status (status)
);

-- =============================================
-- 10. PAYSLIPS TABLE
-- =============================================
CREATE TABLE payslips (
    id INT PRIMARY KEY AUTO_INCREMENT,
    payroll_id INT NOT NULL,
    employee_id INT NOT NULL,
    month INT NOT NULL,
    year INT NOT NULL,
    pdf_path VARCHAR(500),
    generated_by INT,
    generated_on DATETIME DEFAULT CURRENT_TIMESTAMP,
    download_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (payroll_id) REFERENCES payrolls(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uk_payslip_payroll (payroll_id),
    INDEX idx_payslip_employee (employee_id),
    INDEX idx_payslip_month_year (month, year)
);

-- =============================================
-- 11. ACTIVITY LOGS TABLE (Audit Trail)
-- =============================================
CREATE TABLE activity_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_log_company (company_id),
    INDEX idx_log_user (user_id),
    INDEX idx_log_action (action),
    INDEX idx_log_created (created_at)
);

-- =============================================
-- 12. NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT,
    user_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(500),
    is_read BOOLEAN DEFAULT FALSE,
    read_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notification_user (user_id),
    INDEX idx_notification_read (is_read),
    INDEX idx_notification_created (created_at)
);

-- =============================================
-- 13. COMPANY_SETTINGS TABLE
-- =============================================
CREATE TABLE company_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    data_type ENUM('string', 'integer', 'boolean', 'json') DEFAULT 'string',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY uk_setting_company_key (company_id, setting_key),
    INDEX idx_setting_company (company_id)
);

-- =============================================
-- INSERT DEFAULT SUPER ADMIN
-- =============================================
-- Password: Super@Admin123 (hashed with bcrypt)
INSERT INTO users (name, email, password, role, is_active) VALUES (
    'Super Admin',
    'superadmin@system.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYDEfN6S7QO', -- Super@Admin123
    'super_admin',
    TRUE
);

-- =============================================
-- INSERT DEFAULT COMPANY
-- =============================================
INSERT INTO companies (name, code, email, phone, address, city, state, is_active) VALUES (
    'Apex Engineering Enterprises',
    'APEX001',
    'admin@apexengg.com',
    '+91-9876543210',
    '123, Industrial Area, Phase 1',
    'New Delhi',
    'Delhi',
    TRUE
);

-- =============================================
-- INSERT DEFAULT COMPANY ADMIN
-- =============================================
-- Password: Admin@123
INSERT INTO users (company_id, name, email, password, role, is_active) VALUES (
    1,
    'Company Admin',
    'admin@apexengg.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYDEfN6S7QO', -- Admin@123
    'company_admin',
    TRUE
);

-- =============================================
-- INSERT DEFAULT BRANCH
-- =============================================
INSERT INTO branches (company_id, name, code, address, city, state, pincode, phone, email, is_active) VALUES (
    1,
    'Head Office',
    'HO001',
    '123, Industrial Area, Phase 1',
    'New Delhi',
    'Delhi',
    '110001',
    '+91-9876543210',
    'ho@apexengg.com',
    TRUE
);

-- =============================================
-- INSERT DEFAULT EMPLOYEE (linked to company admin user)
-- =============================================
INSERT INTO employees (
    company_id, user_id, branch_id, employee_code, name, email, phone,
    department, designation, date_of_joining, is_active,
    salary_basic, salary_hra, salary_da, salary_ta,
    work_start_hour, work_start_minute, late_threshold_minutes
) VALUES (
    1, 
    2,  -- user_id (Company Admin)
    1,  -- branch_id
    'EMP001',
    'Company Admin',
    'admin@apexengg.com',
    '+91-9876543210',
    'Administration',
    'Administrator',
    CURDATE(),
    TRUE,
    50000,
    15000,
    5000,
    2000,
    9,
    30,
    15
);

-- =============================================
-- UPDATE branch manager_id
-- =============================================
UPDATE branches SET manager_id = 1 WHERE id = 1;

-- =============================================
-- INSERT DEFAULT COMPANY SETTINGS
-- =============================================
INSERT INTO company_settings (company_id, setting_key, setting_value, data_type) VALUES
(1, 'office_start_time', '09:30', 'string'),
(1, 'office_end_time', '18:30', 'string'),
(1, 'late_threshold_minutes', '15', 'integer'),
(1, 'pf_rate', '0.12', 'string'),
(1, 'esic_rate', '0.0075', 'string'),
(1, 'pt_monthly', '200', 'integer'),
(1, 'default_work_hours', '9', 'integer');

-- =============================================
-- INSERT SAMPLE HOLIDAYS
-- =============================================
INSERT INTO holidays (company_id, name, date, type, description, is_weekday, year, month) VALUES
(1, 'Republic Day', '2026-01-26', 'national', 'Republic Day of India', TRUE, 2026, 1),
(1, 'Independence Day', '2026-08-15', 'national', 'Independence Day of India', TRUE, 2026, 8),
(1, 'Gandhi Jayanti', '2026-10-02', 'national', 'Gandhi Jayanti', TRUE, 2026, 10);

-- =============================================
-- VIEWS FOR EASY REPORTING
-- =============================================

-- View: Employee with User and Company details
CREATE VIEW vw_employee_details AS
SELECT 
    e.id AS employee_id,
    e.employee_code,
    e.name AS employee_name,
    e.email AS employee_email,
    e.phone,
    e.department,
    e.designation,
    e.date_of_joining,
    e.profile_image,
    e.is_active AS employee_active,
    u.id AS user_id,
    u.email AS user_email,
    u.role AS user_role,
    c.id AS company_id,
    c.name AS company_name,
    c.code AS company_code,
    b.id AS branch_id,
    b.name AS branch_name,
    b.code AS branch_code
FROM employees e
LEFT JOIN users u ON e.user_id = u.id
LEFT JOIN companies c ON e.company_id = c.id
LEFT JOIN branches b ON e.branch_id = b.id;

-- View: Attendance with Employee and Branch
CREATE VIEW vw_attendance_details AS
SELECT 
    a.id AS attendance_id,
    a.date,
    a.status,
    a.working_hours,
    a.overtime_hours,
    a.is_late,
    a.late_by_minutes,
    a.remarks,
    e.id AS employee_id,
    e.employee_code,
    e.name AS employee_name,
    e.department,
    e.designation,
    b.id AS branch_id,
    b.name AS branch_name,
    c.id AS company_id,
    c.name AS company_name
FROM attendance a
JOIN employees e ON a.employee_id = e.id
LEFT JOIN branches b ON e.branch_id = b.id
LEFT JOIN companies c ON e.company_id = c.id;

-- View: Leave with Employee details
CREATE VIEW vw_leave_details AS
SELECT 
    l.*,
    e.employee_code,
    e.name AS employee_name,
    e.department,
    e.designation,
    u.name AS reviewer_name
FROM leaves l
JOIN employees e ON l.employee_id = e.id
LEFT JOIN users u ON l.reviewed_by = u.id;

-- View: Payroll with Employee details
CREATE VIEW vw_payroll_details AS
SELECT 
    p.*,
    e.employee_code,
    e.name AS employee_name,
    e.department,
    e.designation,
    b.name AS branch_name,
    c.name AS company_name,
    u.name AS processed_by_name
FROM payrolls p
JOIN employees e ON p.employee_id = e.id
LEFT JOIN branches b ON e.branch_id = b.id
LEFT JOIN companies c ON e.company_id = c.id
LEFT JOIN users u ON p.processed_by = u.id;

-- =============================================
-- STORED PROCEDURES
-- =============================================

-- Get employees by company
DELIMITER //
CREATE PROCEDURE sp_get_employees_by_company(IN p_company_id INT)
BEGIN
    SELECT * FROM vw_employee_details 
    WHERE company_id = p_company_id;
END //
DELIMITER ;

-- Get attendance report for a month
DELIMITER //
CREATE PROCEDURE sp_attendance_report(
    IN p_company_id INT,
    IN p_month INT,
    IN p_year INT
)
BEGIN
    SELECT 
        e.employee_code,
        e.name AS employee_name,
        e.department,
        e.designation,
        b.name AS branch_name,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) AS present_days,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) AS absent_days,
        COUNT(CASE WHEN a.status = 'half-day' THEN 1 END) AS half_days,
        COUNT(CASE WHEN a.status = 'on-leave' THEN 1 END) AS leave_days,
        SUM(a.working_hours) AS total_working_hours,
        SUM(a.overtime_hours) AS total_overtime_hours,
        COUNT(CASE WHEN a.is_late = TRUE THEN 1 END) AS late_days
    FROM employees e
    LEFT JOIN attendance a ON e.id = a.employee_id 
        AND MONTH(a.date) = p_month 
        AND YEAR(a.date) = p_year
    LEFT JOIN branches b ON e.branch_id = b.id
    WHERE e.company_id = p_company_id AND e.is_active = TRUE
    GROUP BY e.id;
END //
DELIMITER ;

-- Get employee attendance summary for a month
DELIMITER //
CREATE PROCEDURE sp_employee_attendance_summary(
    IN p_employee_id INT,
    IN p_month INT,
    IN p_year INT
)
BEGIN
    SELECT 
        DATE_FORMAT(date, '%Y-%m-%d') AS date,
        status,
        working_hours,
        overtime_hours,
        is_late,
        late_by_minutes
    FROM attendance
    WHERE employee_id = p_employee_id 
        AND MONTH(date) = p_month 
        AND YEAR(date) = p_year
    ORDER BY date ASC;
END //
DELIMITER ;

-- Calculate monthly payroll for an employee
DELIMITER //
CREATE PROCEDURE sp_calculate_payroll(
    IN p_employee_id INT,
    IN p_month INT,
    IN p_year INT
)
BEGIN
    DECLARE v_basic DECIMAL(10,2);
    DECLARE v_hra DECIMAL(10,2);
    DECLARE v_da DECIMAL(10,2);
    DECLARE v_ta DECIMAL(10,2);
    DECLARE v_total_working_days INT;
    DECLARE v_present_days INT;
    DECLARE v_half_days INT;
    DECLARE v_leave_days INT;
    DECLARE v_absent_days INT;
    DECLARE v_holiday_count INT;
    DECLARE v_weekdays_in_month INT;
    DECLARE v_calendar_days INT;
    DECLARE v_payable_days DECIMAL(5,2);
    DECLARE v_gross_salary DECIMAL(10,2);
    DECLARE v_total_deductions DECIMAL(10,2);
    DECLARE v_net_salary DECIMAL(10,2);
    DECLARE v_esic DECIMAL(10,2);
    DECLARE v_pt DECIMAL(10,2);
    DECLARE v_lop DECIMAL(10,2);
    DECLARE v_overtime_hours DECIMAL(5,2);
    DECLARE v_earning_bonus DECIMAL(10,2);
    
    -- Get employee salary
    SELECT salary_basic, salary_hra, salary_da, salary_ta, 
           salary_basic + salary_hra + salary_da + salary_ta AS gross
    INTO v_basic, v_hra, v_da, v_ta, v_gross_salary
    FROM employees WHERE id = p_employee_id;
    
    -- Calculate working days
    SET v_calendar_days = DAY(LAST_DAY(CONCAT(p_year, '-', p_month, '-01')));
    
    -- Count weekdays (Mon-Fri)
    SELECT COUNT(*) INTO v_weekdays_in_month
    FROM (
        SELECT DATE_ADD(CONCAT(p_year, '-', p_month, '-01'), INTERVAL (seq-1) DAY) AS d
        FROM (
            SELECT @row := @row + 1 AS seq
            FROM information_schema.columns, (SELECT @row := 0) r
            LIMIT 31
        ) seq
        WHERE seq <= v_calendar_days
    ) dates
    WHERE DAYOFWEEK(d) NOT IN (1);  -- 1 = Sunday
    
    -- Count holidays in this month
    SELECT COUNT(*) INTO v_holiday_count
    FROM holidays
    WHERE company_id = (SELECT company_id FROM employees WHERE id = p_employee_id)
    AND MONTH(date) = p_month AND YEAR(date) = p_year
    AND is_weekday = TRUE;
    
    SET v_total_working_days = v_weekdays_in_month - v_holiday_count;
    
    -- Get attendance stats
    SELECT 
        COUNT(CASE WHEN status = 'present' THEN 1 END),
        COUNT(CASE WHEN status = 'half-day' THEN 1 END),
        COUNT(CASE WHEN status = 'on-leave' THEN 1 END),
        COUNT(CASE WHEN status = 'absent' THEN 1 END),
        COALESCE(SUM(overtime_hours), 0)
    INTO v_present_days, v_half_days, v_leave_days, v_absent_days, v_overtime_hours
    FROM attendance
    WHERE employee_id = p_employee_id 
        AND MONTH(date) = p_month AND YEAR(date) = p_year;
    
    -- Calculate payable days
    SET v_payable_days = v_present_days + (v_half_days * 0.5) + v_leave_days;
    IF v_payable_days > v_total_working_days THEN
        SET v_payable_days = v_total_working_days;
    END IF;
    
    -- Calculate LOP
    SET v_lop = (v_absent_days / v_total_working_days) * v_gross_salary;
    
    -- Calculate ESIC (0.75% of gross)
    SET v_esic = v_gross_salary * 0.0075;
    
    -- Professional Tax (fixed)
    SET v_pt = 200;
    
    -- Bonus (overtime pay: 1.5x of hourly rate for overtime)
    -- Assuming 9 working hours per day, 30 days in a month
    SET v_earning_bonus = (v_overtime_hours / (v_total_working_days * 9)) * v_gross_salary * 0.5;
    
    -- Calculate total deductions
    SET v_total_deductions = v_esic + v_pt + v_lop;
    
    -- Calculate net salary
    SET v_net_salary = v_gross_salary - v_total_deductions + v_earning_bonus;
    
    -- Insert or update payroll
    INSERT INTO payrolls (
        employee_id, month, year,
        earning_basic, earning_hra, earning_da, earning_ta,
        earning_overtime, earning_bonus, earning_other,
        deduction_esic, deduction_advance, deduction_pt,
        deduction_lop, deduction_other,
        gross_salary, total_deductions, net_salary,
        att_total_working_days, att_present_days, att_absent_days,
        att_leave_days, att_overtime_hours, att_calendar_days,
        att_weekdays_in_month, att_holiday_count, att_payable_days,
        att_half_days, status
    ) VALUES (
        p_employee_id, p_month, p_year,
        v_basic, v_hra, v_da, v_ta,
        0, v_earning_bonus, 0,
        v_esic, 0, v_pt,
        v_lop, 0,
        v_gross_salary, v_total_deductions, v_net_salary,
        v_total_working_days, v_present_days, v_absent_days,
        v_leave_days, v_overtime_hours, v_calendar_days,
        v_weekdays_in_month, v_holiday_count, v_payable_days,
        v_half_days, 'processed'
    ) ON DUPLICATE KEY UPDATE
        earning_basic = v_basic,
        earning_hra = v_hra,
        earning_da = v_da,
        earning_ta = v_ta,
        earning_bonus = v_earning_bonus,
        deduction_esic = v_esic,
        deduction_pt = v_pt,
        deduction_lop = v_lop,
        gross_salary = v_gross_salary,
        total_deductions = v_total_deductions,
        net_salary = v_net_salary,
        att_total_working_days = v_total_working_days,
        att_present_days = v_present_days,
        att_absent_days = v_absent_days,
        att_leave_days = v_leave_days,
        att_overtime_hours = v_overtime_hours,
        att_calendar_days = v_calendar_days,
        att_weekdays_in_month = v_weekdays_in_month,
        att_holiday_count = v_holiday_count,
        att_payable_days = v_payable_days,
        att_half_days = v_half_days,
        status = 'processed',
        processed_on = NOW();
    
    SELECT * FROM payrolls 
    WHERE employee_id = p_employee_id 
        AND month = p_month AND year = p_year;
END //
DELIMITER ;

-- =============================================
-- TRIGGERS
-- =============================================

-- Auto-generate employee code
DELIMITER //
CREATE TRIGGER trg_employee_before_insert
BEFORE INSERT ON employees
FOR EACH ROW
BEGIN
    DECLARE v_count INT;
    IF NEW.employee_code IS NULL OR NEW.employee_code = '' THEN
        SELECT COUNT(*) + 1 INTO v_count FROM employees WHERE company_id = NEW.company_id;
        SET NEW.employee_code = CONCAT('EMP', LPAD(v_count, 3, '0'));
    END IF;
END //
DELIMITER ;

-- Update holiday year/month before insert
DELIMITER //
CREATE TRIGGER trg_holiday_before_insert
BEFORE INSERT ON holidays
FOR EACH ROW
BEGIN
    SET NEW.year = YEAR(NEW.date);
    SET NEW.month = MONTH(NEW.date);
    SET NEW.is_weekday = (DAYOFWEEK(NEW.date) NOT IN (1, 7));
END //
DELIMITER ;

-- Update holiday year/month before update
DELIMITER //
CREATE TRIGGER trg_holiday_before_update
BEFORE UPDATE ON holidays
FOR EACH ROW
BEGIN
    IF NEW.date <> OLD.date THEN
        SET NEW.year = YEAR(NEW.date);
        SET NEW.month = MONTH(NEW.date);
        SET NEW.is_weekday = (DAYOFWEEK(NEW.date) NOT IN (1, 7));
    END IF;
END //
DELIMITER ;

-- Log employee changes
DELIMITER //
CREATE TRIGGER trg_employee_after_update
AFTER UPDATE ON employees
FOR EACH ROW
BEGIN
    IF OLD.is_active <> NEW.is_active THEN
        UPDATE users 
        SET is_active = NEW.is_active 
        WHERE id = NEW.user_id;
    END IF;
END //
DELIMITER ;

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function: Count working days in a month (Mon-Fri)
DELIMITER //
CREATE FUNCTION fn_count_working_days(p_year INT, p_month INT) 
RETURNS INT
DETERMINISTIC
BEGIN
    DECLARE v_count INT;
    DECLARE v_calendar_days INT;
    
    SET v_calendar_days = DAY(LAST_DAY(CONCAT(p_year, '-', p_month, '-01')));
    
    SELECT COUNT(*) INTO v_count
    FROM (
        SELECT DATE_ADD(CONCAT(p_year, '-', p_month, '-01'), INTERVAL (seq-1) DAY) AS d
        FROM (
            SELECT @row := @row + 1 AS seq
            FROM information_schema.columns, (SELECT @row := 0) r
            LIMIT 31
        ) seq
        WHERE seq <= v_calendar_days
    ) dates
    WHERE DAYOFWEEK(d) NOT IN (1, 7);  -- 1=Sunday, 7=Saturday
    
    RETURN v_count;
END //
DELIMITER ;

-- Function: Get employee full name
DELIMITER //
CREATE FUNCTION fn_get_employee_name(p_employee_id INT) 
RETURNS VARCHAR(255)
DETERMINISTIC
BEGIN
    DECLARE v_name VARCHAR(255);
    SELECT name INTO v_name FROM employees WHERE id = p_employee_id;
    RETURN v_name;
END //
DELIMITER ;