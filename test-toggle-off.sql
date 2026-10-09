-- Verification test: this attendance record should NOT be auto-checked-out
-- if auto_checkout_enabled is OFF for the company.

INSERT INTO attendance (employee_id, date, status, working_hours, overtime_hours, is_late, late_by_minutes, remarks, is_deleted, created_at, updated_at)
VALUES (1, CURDATE(), 'present', 0, 0, 0, 0, 'Test - verifying auto-checkout OFF behavior', 0, NOW(), NOW());
SET @att_verify = LAST_INSERT_ID();

INSERT INTO punches (attendance_id, type, time, latitude, longitude, address, face_verified, is_late, late_by_minutes, created_at, updated_at)
VALUES (@att_verify, 'check_in', CONCAT(CURDATE(), ' 09:10:00'), 28.6139, 77.2090, 'Connaught Place, New Delhi', 1, 0, 0, NOW(), NOW());

-- No check_out punch -- this record is intentionally left open, same as before.
