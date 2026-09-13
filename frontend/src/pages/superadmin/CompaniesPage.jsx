import React, { useEffect, useState } from "react";
import { companyAPI, branchAPI } from "../../services/api";
import {
  BuildingOffice2Icon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  UsersIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import Modal from "../../components/common/Modal";
import { toast } from "react-hot-toast";
import "./CompaniesPage.css";

const emptyForm = {
  name: "",
  code: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  pincode: "",

  // Payroll working days
  workingDaysPerWeek: 6,

  // Default Sunday off
  weekOffDays: ["sunday"],
};

const weekDays = [
  {
    value: "monday",
    label: "Monday",
    short: "Mon",
  },
  {
    value: "tuesday",
    label: "Tuesday",
    short: "Tue",
  },
  {
    value: "wednesday",
    label: "Wednesday",
    short: "Wed",
  },
  {
    value: "thursday",
    label: "Thursday",
    short: "Thu",
  },
  {
    value: "friday",
    label: "Friday",
    short: "Fri",
  },
  {
    value: "saturday",
    label: "Saturday",
    short: "Sat",
  },
  {
    value: "sunday",
    label: "Sunday",
    short: "Sun",
  },
];

const CompaniesPage = () => {
  const [companies, setCompanies] = useState([]);
  const [branchCounts, setBranchCounts] = useState({});

  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [updatingSetting, setUpdatingSetting] = useState(null);

  const loadCompanies = async () => {
    try {
      setLoading(true);

      const res = await companyAPI.getAll();

      const list =
        res?.data?.data?.companies ||
        res?.data?.companies ||
        res?.data?.data ||
        res?.data ||
        [];

      const companyList = Array.isArray(list) ? list : [];

      setCompanies(companyList);

      await loadBranchCounts(companyList);
    } catch (error) {
      console.error("Failed to load companies:", error);

      toast.error(error?.response?.data?.message || "Failed to load companies");

      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const loadBranchCounts = async (companyList) => {
    try {
      const counts = {};

      await Promise.all(
        companyList.map(async (company) => {
          const companyId = company.id;

          if (!companyId) return;

          try {
            const res = await branchAPI.getAll({
              company_id: companyId,
            });

            const branches =
              res?.data?.data?.branches ||
              res?.data?.branches ||
              res?.data?.data ||
              res?.data ||
              [];

            counts[companyId] = Array.isArray(branches) ? branches.length : 0;
          } catch (error) {
            console.error(
              `Failed to load branches for company ${companyId}:`,
              error,
            );

            counts[companyId] = 0;
          }
        }),
      );

      setBranchCounts(counts);
    } catch (error) {
      console.error("Failed to load branch counts:", error);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleWorkingDaysChange = (e) => {
    const workingDays = Number(e.target.value);

    const requiredOffDays = 7 - workingDays;

    setForm((prev) => {
      let nextWeekOffDays = Array.isArray(prev.weekOffDays)
        ? [...prev.weekOffDays]
        : [];

      if (requiredOffDays === 0) {
        nextWeekOffDays = [];
      }

      if (nextWeekOffDays.length > requiredOffDays) {
        nextWeekOffDays = nextWeekOffDays.slice(0, requiredOffDays);
      }

      if (nextWeekOffDays.length < requiredOffDays) {
        const preferredDays = [
          "sunday",
          "saturday",
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
        ];

        for (const day of preferredDays) {
          if (nextWeekOffDays.length >= requiredOffDays) {
            break;
          }

          if (!nextWeekOffDays.includes(day)) {
            nextWeekOffDays.push(day);
          }
        }
      }

      return {
        ...prev,
        workingDaysPerWeek: workingDays,
        weekOffDays: nextWeekOffDays,
      };
    });
  };

  const handleWeekOffChange = (day) => {
    setForm((prev) => {
      const currentDays = Array.isArray(prev.weekOffDays)
        ? prev.weekOffDays
        : [];

      const exists = currentDays.includes(day);

      /*
       * If currently selected, remove it.
       */
      if (exists) {
        const nextDays = currentDays.filter((item) => item !== day);

        return {
          ...prev,
          weekOffDays: nextDays,
          workingDaysPerWeek: 7 - nextDays.length,
        };
      }

      /*
       * Add day only if we have not reached
       * the maximum allowed off days.
       */
      const maxOffDays = 7 - Number(prev.workingDaysPerWeek || 6);

      if (currentDays.length >= maxOffDays) {
        toast.error(
          `For ${prev.workingDaysPerWeek} working days, select only ${maxOffDays} day off${maxOffDays === 1 ? "" : "s"}`,
        );

        return prev;
      }

      const nextDays = [...currentDays, day];

      return {
        ...prev,
        weekOffDays: nextDays,
        workingDaysPerWeek: 7 - nextDays.length,
      };
    });
  };

  const openCreateModal = () => {
    setEditingId(null);

    setForm({
      ...emptyForm,
      workingDaysPerWeek: 6,
      weekOffDays: ["sunday"],
    });

    setModalOpen(true);
  };

  const openEditModal = (company) => {
    let weekOffDays = company.week_off_days ??
      company.weekOffDays ?? ["sunday"];

    /*
     * Backend may return JSON string.
     *
     * Example:
     * '["saturday","sunday"]'
     */
    if (typeof weekOffDays === "string") {
      try {
        weekOffDays = JSON.parse(weekOffDays);
      } catch (error) {
        console.error("Failed to parse week off days:", error);

        weekOffDays = ["sunday"];
      }
    }

    if (!Array.isArray(weekOffDays)) {
      weekOffDays = ["sunday"];
    }

    const workingDays =
      Number(
        company.working_days_per_week ??
          company.workingDaysPerWeek ??
          7 - weekOffDays.length,
      ) || 6;

    setEditingId(company.id);

    setForm({
      name: company.name || "",
      code: company.code || "",
      email: company.email || "",
      phone: company.phone || "",
      address: company.address || "",
      city: company.city || "",
      state: company.state || "",
      pincode: company.pincode || "",

      workingDaysPerWeek: workingDays,

      weekOffDays,
    });

    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingId(null);
    setForm({
      ...emptyForm,
      weekOffDays: ["sunday"],
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    /*
     * Company name
     */
    if (!form.name.trim()) {
      toast.error("Company name is required");
      return;
    }

    /*
     * Company code
     */
    if (!form.code.trim()) {
      toast.error("Company code is required");
      return;
    }

    /*
     * Company email
     */
    if (!form.email.trim()) {
      toast.error("Company email is required");
      return;
    }

    /*
     * Working days
     */
    const workingDays = Number(form.workingDaysPerWeek);

    /*
     * Week off days
     */
    const weekOffDays = Array.isArray(form.weekOffDays) ? form.weekOffDays : [];

    /*
     * Validate working days
     */
    if (!Number.isInteger(workingDays) || workingDays < 1 || workingDays > 7) {
      toast.error("Working days must be between 1 and 7");
      return;
    }

    /*
     * Validate exact relationship
     *
     * 7 - off days = working days
     */
    const calculatedWorkingDays = 7 - weekOffDays.length;

    if (calculatedWorkingDays !== workingDays) {
      toast.error(
        `For ${workingDays} working days, select exactly ${7 - workingDays} weekly off day${7 - workingDays === 1 ? "" : "s"}`,
      );

      return;
    }

    /*
     * Prevent duplicate days
     */
    const uniqueWeekOffDays = [...new Set(weekOffDays)];

    if (uniqueWeekOffDays.length !== weekOffDays.length) {
      toast.error("Duplicate weekly off days are not allowed");
      return;
    }

    /*
     * Prepare payload
     */
    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      email: form.email.trim(),

      phone: form.phone?.trim() || "",

      address: form.address?.trim() || "",

      city: form.city?.trim() || "",

      state: form.state?.trim() || "",

      pincode: form.pincode?.trim() || "",

      /*
       * Payroll configuration
       */
      workingDaysPerWeek: workingDays,

      weekOffDays: uniqueWeekOffDays,
    };

    try {
      setSaving(true);

      if (editingId) {
        /*
         * Existing update endpoint
         */
        await companyAPI.update(editingId, payload);

        toast.success("Company updated successfully");
      } else {
        /*
         * Create company
         */
        await companyAPI.create(payload);

        toast.success("Company created successfully");
      }

      setModalOpen(false);
      setEditingId(null);

      setForm({
        ...emptyForm,
        weekOffDays: ["sunday"],
      });

      await loadCompanies();
    } catch (error) {
      console.error("Save company error:", error);

      toast.error(error?.response?.data?.message || "Failed to save company");
    } finally {
      setSaving(false);
    }
  };

  const handleEmployeeTrackingToggle = async (company) => {
    const companyId = company.id;

    if (!companyId) {
      toast.error("Company ID not found");
      return;
    }

    const currentValue =
      company.employee_tracking_enabled ??
      company.employeeTrackingEnabled ??
      false;

    const nextValue = !Boolean(currentValue);

    const settingKey = `${companyId}-tracking`;

    try {
      setUpdatingSetting(settingKey);

      await companyAPI.updateEmployeeTracking(companyId, nextValue);

      setCompanies((prev) =>
        prev.map((item) =>
          item.id === companyId
            ? {
                ...item,
                employee_tracking_enabled: nextValue,
              }
            : item,
        ),
      );

      toast.success(
        nextValue ? "Employee tracking enabled" : "Employee tracking disabled",
      );
    } catch (error) {
      console.error("Employee tracking error:", error);

      toast.error(
        error?.response?.data?.message || "Failed to update employee tracking",
      );
    } finally {
      setUpdatingSetting(null);
    }
  };

  const handleOfficeLocationToggle = async (company) => {
    const companyId = company.id;

    if (!companyId) {
      toast.error("Company ID not found");
      return;
    }

    const currentValue =
      company.office_location_enabled ?? company.officeLocationEnabled ?? false;

    const nextValue = !Boolean(currentValue);

    const settingKey = `${companyId}-office`;

    try {
      setUpdatingSetting(settingKey);

      await companyAPI.updateOfficeLocation(companyId, nextValue);

      setCompanies((prev) =>
        prev.map((item) =>
          item.id === companyId
            ? {
                ...item,
                office_location_enabled: nextValue,
              }
            : item,
        ),
      );

      toast.success(
        nextValue ? "Office location enabled" : "Office location disabled",
      );
    } catch (error) {
      console.error("Office location error:", error);

      toast.error(
        error?.response?.data?.message || "Failed to update office location",
      );
    } finally {
      setUpdatingSetting(null);
    }
  };

  const handleEmployeeLimitUpdate = async (company, value) => {
    const companyId = company.id;

    if (!companyId) {
      toast.error("Company ID not found");
      return;
    }

    const limit = Number(value);

    if (!Number.isInteger(limit) || limit < 0) {
      toast.error("Employee limit must be a valid number");
      return;
    }

    const currentEmployeeCount =
      Number(company.current_employee_count ?? company.employee_count ?? 0) ||
      0;

    if (limit < currentEmployeeCount) {
      toast.error(
        `Employee limit cannot be less than current employee count (${currentEmployeeCount})`,
      );
      return;
    }

    const settingKey = `${companyId}-limit`;

    try {
      setUpdatingSetting(settingKey);

      await companyAPI.updateEmployeeLimit(companyId, limit);

      setCompanies((prev) =>
        prev.map((item) =>
          item.id === companyId
            ? {
                ...item,
                employee_limit: limit,
              }
            : item,
        ),
      );

      toast.success("Employee limit updated");
    } catch (error) {
      console.error("Employee limit error:", error);

      toast.error(
        error?.response?.data?.message || "Failed to update employee limit",
      );
    } finally {
      setUpdatingSetting(null);
    }
  };
  const handleToggleStatus = async (company) => {
    const companyId = company.id;

    if (!companyId) {
      toast.error("Company ID not found");
      return;
    }

    const settingKey = `${companyId}-status`;

    try {
      setUpdatingSetting(settingKey);

      const res = await companyAPI.toggleStatus(companyId);

      const responseCompany = res?.data?.data || res?.data || {};

      const newStatus =
        typeof responseCompany.is_active === "boolean"
          ? responseCompany.is_active
          : !Boolean(company.is_active);

      setCompanies((prev) =>
        prev.map((item) =>
          item.id === companyId
            ? {
                ...item,
                is_active: newStatus,
              }
            : item,
        ),
      );

      toast.success(newStatus ? "Company activated" : "Company deactivated");
    } catch (error) {
      console.error("Toggle status error:", error);

      toast.error(
        error?.response?.data?.message || "Failed to update company status",
      );
    } finally {
      setUpdatingSetting(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;

    try {
      setDeleting(true);

      await companyAPI.delete(deleteTarget.id);

      toast.success("Company deleted successfully");

      setDeleteTarget(null);

      await loadCompanies();
    } catch (error) {
      console.error("Delete company error:", error);

      toast.error(error?.response?.data?.message || "Failed to delete company");
    } finally {
      setDeleting(false);
    }
  };

  const activeCount = companies.filter(
    (company) => company.is_active !== false,
  ).length;

  const inactiveCount = companies.filter(
    (company) => company.is_active === false,
  ).length;

  const totalBranches = Object.values(branchCounts).reduce(
    (sum, count) => sum + Number(count || 0),
    0,
  );

  const getCompanyWeekOffDays = (company) => {
    let days = company.week_off_days ?? company.weekOffDays ?? [];

    if (typeof days === "string") {
      try {
        days = JSON.parse(days);
      } catch {
        days = [];
      }
    }

    return Array.isArray(days) ? days : [];
  };

  if (loading) {
    return (
      <div className="sa-page">
        <div className="sa-loading">
          <ArrowPathIcon className="sa-loading-icon" />

          <p>Loading companies...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="sa-page">
      <div className="sa-header">
        <div>
          <div className="sa-title-row">
            <BuildingOffice2Icon className="sa-title-icon" />

            <div>
              <h1 className="sa-title">Companies</h1>

              <p className="sa-subtitle">
                Manage companies, employee limits and company settings
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="sa-primary-btn"
          onClick={openCreateModal}
        >
          <PlusIcon className="sa-btn-icon" />
          Add Company
        </button>
      </div>

      <div className="sa-stats">
        <div className="sa-stat-card">
          <div className="sa-stat-icon">
            <BuildingOffice2Icon />
          </div>

          <div>
            <div className="sa-stat-value">{companies.length}</div>

            <div className="sa-stat-label">Total Companies</div>
          </div>
        </div>

        <div className="sa-stat-card">
          <div className="sa-stat-icon">
            <CheckCircleIcon />
          </div>

          <div>
            <div className="sa-stat-value">{activeCount}</div>

            <div className="sa-stat-label">Active Companies</div>
          </div>
        </div>

        <div className="sa-stat-card">
          <div className="sa-stat-icon">
            <XCircleIcon />
          </div>

          <div>
            <div className="sa-stat-value">{inactiveCount}</div>

            <div className="sa-stat-label">Inactive Companies</div>
          </div>
        </div>

        <div className="sa-stat-card">
          <div className="sa-stat-icon">
            <UsersIcon />
          </div>

          <div>
            <div className="sa-stat-value">{totalBranches}</div>

            <div className="sa-stat-label">Total Branches</div>
          </div>
        </div>
      </div>

      {companies.length === 0 ? (
        <div className="sa-empty">
          <BuildingOffice2Icon className="sa-empty-icon" />

          <h3>No companies found</h3>

          <p>
            Create your first company to start managing employees and settings.
          </p>

          <button
            type="button"
            className="sa-primary-btn"
            onClick={openCreateModal}
          >
            <PlusIcon className="sa-btn-icon" />
            Add Company
          </button>
        </div>
      ) : (
        <div className="sa-company-grid">
          {companies.map((company) => {
            const companyId = company.id;

            const trackingEnabled = Boolean(
              company.employee_tracking_enabled ??
              company.employeeTrackingEnabled ??
              false,
            );

            const officeLocationEnabled = Boolean(
              company.office_location_enabled ??
              company.officeLocationEnabled ??
              false,
            );

            const currentEmployeeCount =
              Number(
                company.current_employee_count ?? company.employee_count ?? 0,
              ) || 0;

            const employeeLimit = Number(company.employee_limit ?? 0) || 0;

            const branchCount = Number(branchCounts[companyId] || 0);

            const weekOffDays = getCompanyWeekOffDays(company);

            const workingDays =
              Number(
                company.working_days_per_week ??
                  company.workingDaysPerWeek ??
                  7 - weekOffDays.length,
              ) || 0;

            return (
              <div className="sa-company-card" key={companyId}>
                <div className="sa-card-header">
                  <div className="sa-company-icon">
                    <BuildingOffice2Icon />
                  </div>

                  <div className="sa-company-heading">
                    <h2>{company.name || "Unnamed Company"}</h2>

                    {company.code && (
                      <span className="sa-company-code">{company.code}</span>
                    )}
                  </div>

                  <div className="sa-card-actions">
                    <button
                      type="button"
                      className="sa-icon-btn"
                      onClick={() => openEditModal(company)}
                      title="Edit company"
                    >
                      <PencilIcon />
                    </button>

                    <button
                      type="button"
                      className="sa-icon-btn sa-delete-btn"
                      onClick={() => setDeleteTarget(company)}
                      title="Delete company"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>

                <div className="sa-contact-list">
                  {company.email && (
                    <div className="sa-contact-item">
                      <EnvelopeIcon />

                      <span>{company.email}</span>
                    </div>
                  )}

                  {company.phone && (
                    <div className="sa-contact-item">
                      <PhoneIcon />

                      <span>{company.phone}</span>
                    </div>
                  )}

                  {(company.address || company.city || company.state) && (
                    <div className="sa-contact-item">
                      <MapPinIcon />

                      <span>
                        {[
                          company.address,
                          company.city,
                          company.state,
                          company.pincode,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="sa-schedule-card">
                  <div className="sa-schedule-header">
                    <div>
                      <div className="sa-setting-label">Payroll Schedule</div>

                      <div className="sa-setting-value">
                        {workingDays} working day
                        {workingDays === 1 ? "" : "s"} per week
                      </div>
                    </div>

                    <div className="sa-schedule-count">{workingDays}/7</div>
                  </div>

                  <div className="sa-weekoff-display">
                    <span className="sa-weekoff-title">Weekly Off:</span>

                    {weekOffDays.length === 0 ? (
                      <span className="sa-no-weekoff">No weekly off</span>
                    ) : (
                      weekOffDays.map((day) => (
                        <span key={day} className="sa-weekoff-badge">
                          {day.charAt(0).toUpperCase() + day.slice(1)}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="sa-settings">
                  {/* EMPLOYEE TRACKING */}

                  <div className="sa-setting-row">
                    <div className="sa-setting-info">
                      <div className="sa-setting-label">Employee Tracking</div>

                      <div className="sa-setting-value">
                        {trackingEnabled
                          ? "Live tracking enabled"
                          : "Live tracking disabled"}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`sa-toggle ${trackingEnabled ? "on" : ""}`}
                      onClick={() => handleEmployeeTrackingToggle(company)}
                      disabled={updatingSetting === `${companyId}-tracking`}
                      aria-label="Toggle employee tracking"
                    >
                      <span className="sa-toggle-knob" />
                    </button>
                  </div>

                  {/* OFFICE LOCATION */}

                  <div className="sa-setting-row">
                    <div className="sa-setting-info">
                      <div className="sa-setting-label">Office Location</div>

                      <div className="sa-setting-value">
                        {officeLocationEnabled
                          ? "Office location enabled"
                          : "Office location disabled"}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`sa-toggle ${
                        officeLocationEnabled ? "on" : ""
                      }`}
                      onClick={() => handleOfficeLocationToggle(company)}
                      disabled={updatingSetting === `${companyId}-office`}
                      aria-label="Toggle office location"
                    >
                      <span className="sa-toggle-knob" />
                    </button>
                  </div>

                  {/* EMPLOYEE LIMIT */}

                  <div className="sa-setting-row sa-limit-row">
                    <div className="sa-setting-info">
                      <div className="sa-setting-label">Employee Limit</div>

                      <div className="sa-setting-value">
                        Current employees:{" "}
                        <strong>{currentEmployeeCount}</strong>
                      </div>
                    </div>

                    <div className="sa-limit-control">
                      <input
                        type="number"
                        min={currentEmployeeCount}
                        className="sa-limit-input"
                        defaultValue={employeeLimit}
                        id={`employee-limit-${companyId}`}
                        disabled={updatingSetting === `${companyId}-limit`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleEmployeeLimitUpdate(company, e.target.value);
                          }
                        }}
                      />

                      <button
                        type="button"
                        className="sa-limit-save"
                        onClick={() => {
                          const input = document.getElementById(
                            `employee-limit-${companyId}`,
                          );

                          handleEmployeeLimitUpdate(company, input?.value);
                        }}
                        disabled={updatingSetting === `${companyId}-limit`}
                      >
                        {updatingSetting === `${companyId}-limit`
                          ? "..."
                          : "Save"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="sa-card-footer">
                  <div className="sa-branch-count">
                    <UsersIcon />

                    <span>
                      <strong>{branchCount}</strong> branch
                      {branchCount === 1 ? "" : "es"}
                    </span>
                  </div>

                  <button
                    type="button"
                    className={`sa-status-pill ${
                      company.is_active === false ? "inactive" : "active"
                    }`}
                    onClick={() => handleToggleStatus(company)}
                    disabled={updatingSetting === `${companyId}-status`}
                    title="Click to toggle company status"
                  >
                    {company.is_active === false ? (
                      <>
                        <XCircleIcon />
                        Inactive
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon />
                        Active
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingId ? "Edit Company" : "Create Company"}
      >
        <form onSubmit={handleSubmit} className="sa-company-form">
          <div className="sa-form-grid">
            {/* COMPANY NAME */}

            <div className="sa-form-group">
              <label>
                Company Name
                <span className="required">*</span>
              </label>

              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Enter company name"
                required
              />
            </div>

            {/* CODE */}

            <div className="sa-form-group">
              <label>
                Company Code
                <span className="required">*</span>
              </label>

              <input
                type="text"
                name="code"
                value={form.code}
                onChange={handleChange}
                placeholder="Enter company code"
                required
              />
            </div>

            {/* EMAIL */}

            <div className="sa-form-group">
              <label>
                Email
                <span className="required">*</span>
              </label>

              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="company@example.com"
                required
              />
            </div>

            {/* PHONE */}

            <div className="sa-form-group">
              <label>Phone</label>

              <input
                type="text"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="Enter phone number"
              />
            </div>

            {/* ADDRESS */}

            <div className="sa-form-group sa-full-width">
              <label>Address</label>

              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Enter company address"
                rows={3}
              />
            </div>

            {/* CITY */}

            <div className="sa-form-group">
              <label>City</label>

              <input
                type="text"
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="Enter city"
              />
            </div>

            {/* STATE */}

            <div className="sa-form-group">
              <label>State</label>

              <input
                type="text"
                name="state"
                value={form.state}
                onChange={handleChange}
                placeholder="Enter state"
              />
            </div>

            {/* PINCODE */}

            <div className="sa-form-group">
              <label>Pincode</label>

              <input
                type="text"
                name="pincode"
                value={form.pincode}
                onChange={handleChange}
                placeholder="Enter pincode"
              />
            </div>

            <div className="sa-form-section sa-full-width">
              <div className="sa-form-section-title">Payroll Working Days</div>

              <div className="sa-form-section-description">
                Configure the company's weekly working schedule. This will be
                used for payroll and attendance calculations.
              </div>
            </div>

            {/* WORKING DAYS PER WEEK */}

            <div className="sa-form-group">
              <label>
                Working Days Per Week
                <span className="required">*</span>
              </label>

              <select
                name="workingDaysPerWeek"
                value={form.workingDaysPerWeek}
                onChange={handleWorkingDaysChange}
                required
              >
                <option value={7}>7 Days</option>

                <option value={6}>6 Days</option>

                <option value={5}>5 Days</option>

                <option value={4}>4 Days</option>

                <option value={3}>3 Days</option>

                <option value={2}>2 Days</option>

                <option value={1}>1 Day</option>
              </select>

              <small className="sa-form-help">
                {form.workingDaysPerWeek} working day
                {Number(form.workingDaysPerWeek) === 1 ? "" : "s"} per week
              </small>
            </div>

            {/* WEEKLY OFF DAYS */}

            <div className="sa-form-group sa-full-width">
              <label>
                Weekly Days Off
                <span className="required">*</span>
              </label>

              <div className="sa-weekoff-grid">
                {weekDays.map((day) => {
                  const selected =
                    Array.isArray(form.weekOffDays) &&
                    form.weekOffDays.includes(day.value);

                  return (
                    <label
                      key={day.value}
                      className={`sa-weekoff-option ${
                        selected ? "selected" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => handleWeekOffChange(day.value)}
                      />

                      <span>{day.label}</span>
                    </label>
                  );
                })}
              </div>

              <div className="sa-weekoff-summary">
                <div>
                  <strong>Working Days:</strong> {form.workingDaysPerWeek}
                </div>

                <div>
                  <strong>Days Off:</strong>{" "}
                  {Array.isArray(form.weekOffDays)
                    ? form.weekOffDays.length
                    : 0}
                </div>
              </div>

              <small className="sa-form-help">
                Select exactly {7 - Number(form.workingDaysPerWeek)} weekly off
                day
                {7 - Number(form.workingDaysPerWeek) === 1 ? "" : "s"}.
              </small>
            </div>
          </div>

          <div className="sa-modal-footer">
            <button
              type="button"
              className="sa-secondary-btn"
              onClick={closeModal}
              disabled={saving}
            >
              Cancel
            </button>

            <button type="submit" className="sa-primary-btn" disabled={saving}>
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Company"
                  : "Create Company"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete Company"
      >
        <div className="sa-delete-confirm">
          <div className="sa-delete-warning">
            <TrashIcon />
          </div>

          <h3>
            Delete <strong>{deleteTarget?.name || "this company"}</strong>?
          </h3>

          <p>
            This will deactivate the company and its related users, employees
            and branches.
          </p>

          <div className="sa-modal-footer">
            <button
              type="button"
              className="sa-secondary-btn"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </button>

            <button
              type="button"
              className="sa-danger-btn"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Company"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CompaniesPage;
