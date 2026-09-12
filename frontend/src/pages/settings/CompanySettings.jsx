// src/pages/settings/CompanySettings.jsx

import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { companyAPI } from "../../services/api";
import toast from "react-hot-toast";

import {
  BuildingOffice2Icon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  IdentificationIcon,
  DocumentTextIcon,
  CloudArrowUpIcon,
  PencilIcon,
  XMarkIcon,
  TrashIcon,
  GlobeAltIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

/* =========================================================
   Styles
========================================================= */

const CSS = `
  .cs-root {
    min-height: 100vh;
    padding: 30px;
    background: #F6F7F9;
    color: #15171C;
    -webkit-font-smoothing: antialiased;
  }

  .cs-root *,
  .cs-root *::before,
  .cs-root *::after {
    box-sizing: border-box;
  }

  .cs-shell {
    width: 100%;
    max-width: 1380px;
    margin: 0 auto;
  }

  /* =======================================================
     Header
  ======================================================= */

  .cs-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 28px;
  }

  .cs-eyebrow {
    margin-bottom: 8px;
    color: #3567D6;
    font-size: 11px;
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .cs-header h1 {
    margin: 0;
    color: #15171C;
    font-size: 30px;
    line-height: 1.15;
    font-weight: 750;
    letter-spacing: -0.035em;
  }

  .cs-header p {
    margin: 8px 0 0;
    color: #676C76;
    font-size: 14px;
  }

  .cs-header-status {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 10px;
    border: 1px solid #DDEFE6;
    border-radius: 999px;
    background: #F2FAF6;
    color: #16845B;
    font-size: 11px;
    font-weight: 700;
  }

  .cs-header-status svg {
    width: 14px;
    height: 14px;
  }

  /* =======================================================
     Overview
  ======================================================= */

  .cs-overview {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) repeat(3, minmax(150px, 1fr));
    gap: 14px;
    margin-bottom: 22px;
  }

  .cs-company-overview {
    display: flex;
    align-items: center;
    gap: 15px;
    min-height: 100px;
    padding: 18px;
    border: 1px solid #E7E9ED;
    border-radius: 13px;
    background: #FFFFFF;
    box-shadow: 0 2px 8px rgba(20, 24, 32, 0.025);
  }

  .cs-overview-logo {
    width: 58px;
    height: 58px;
    flex: 0 0 58px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 1px solid #E3E6EB;
    border-radius: 12px;
    background: #FAFBFC;
  }

  .cs-overview-logo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .cs-overview-logo svg {
    width: 25px;
    height: 25px;
    color: #3567D6;
  }

  .cs-overview-company {
    min-width: 0;
  }

  .cs-overview-company strong {
    display: block;
    overflow: hidden;
    color: #15171C;
    font-size: 16px;
    font-weight: 720;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cs-overview-company span {
    display: block;
    margin-top: 4px;
    overflow: hidden;
    color: #858A94;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cs-stat-card {
    min-height: 100px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 17px;
    border: 1px solid #E7E9ED;
    border-radius: 13px;
    background: #FFFFFF;
    box-shadow: 0 2px 8px rgba(20, 24, 32, 0.025);
  }

  .cs-stat-icon {
    width: 40px;
    height: 40px;
    flex: 0 0 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
  }

  .cs-stat-icon svg {
    width: 20px;
    height: 20px;
  }

  .cs-stat-icon.blue {
    background: #EDF3FF;
    color: #3567D6;
  }

  .cs-stat-icon.green {
    background: #EAF7F1;
    color: #16845B;
  }

  .cs-stat-icon.orange {
    background: #FFF4E5;
    color: #C97816;
  }

  .cs-stat-content span {
    display: block;
    margin-bottom: 4px;
    color: #858A94;
    font-size: 10px;
    font-weight: 600;
  }

  .cs-stat-content strong {
    display: block;
    overflow: hidden;
    color: #30343B;
    font-size: 13px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* =======================================================
     Main Grid
  ======================================================= */

  .cs-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 16px;
  }

  .cs-card {
    min-width: 0;
    padding: 21px;
    border: 1px solid #E7E9ED;
    border-radius: 14px;
    background: #FFFFFF;
    box-shadow: 0 2px 9px rgba(20, 24, 32, 0.025);
  }

  .cs-full {
    grid-column: 1 / -1;
  }

  .cs-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 15px;
    margin-bottom: 19px;
  }

  .cs-card-title {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .cs-card-title-icon {
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    background: #EDF3FF;
    color: #3567D6;
  }

  .cs-card-title-icon.green {
    background: #EAF7F1;
    color: #16845B;
  }

  .cs-card-title-icon.orange {
    background: #FFF4E5;
    color: #C97816;
  }

  .cs-card-title-icon svg {
    width: 17px;
    height: 17px;
  }

  .cs-card-title-copy h2 {
    margin: 0;
    color: #252930;
    font-size: 14px;
    font-weight: 720;
    letter-spacing: -0.01em;
  }

  .cs-card-title-copy p {
    margin: 4px 0 0;
    color: #969BA5;
    font-size: 10px;
    line-height: 1.45;
  }

  /* =======================================================
     Fields
  ======================================================= */

  .cs-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 15px;
  }

  .cs-field {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .cs-field-full {
    grid-column: 1 / -1;
  }

  .cs-label {
    color: #555B65;
    font-size: 11px;
    font-weight: 650;
  }

  .cs-input {
    width: 100%;
    height: 42px;
    padding: 0 12px;
    border: 1px solid #DFE2E7;
    border-radius: 8px;
    outline: none;
    background: #FFFFFF;
    color: #15171C;
    font-family: inherit;
    font-size: 12px;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease,
      background 0.15s ease;
  }

  .cs-input:hover {
    border-color: #CFD3DA;
  }

  .cs-input:focus {
    border-color: #3567D6;
    box-shadow: 0 0 0 3px rgba(53, 103, 214, 0.1);
  }

  .cs-input::placeholder {
    color: #A4A8B0;
  }

  .cs-textarea {
    min-height: 88px;
    padding-top: 11px;
    padding-bottom: 11px;
    resize: vertical;
    line-height: 1.5;
  }

  /* =======================================================
     Logo Card
  ======================================================= */

  .cs-logo-card {
    min-height: 100%;
  }

  .cs-logo-layout {
    display: grid;
    grid-template-columns: 170px minmax(0, 1fr);
    align-items: center;
    gap: 22px;
  }

  .cs-logo-preview {
    width: 170px;
    height: 150px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 1px dashed #D7DBE2;
    border-radius: 13px;
    background: #FAFBFC;
  }

  .cs-logo-preview img {
    width: 100%;
    height: 100%;
    padding: 13px;
    object-fit: contain;
  }

  .cs-logo-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 7px;
    color: #A0A5AE;
    text-align: center;
  }

  .cs-logo-placeholder svg {
    width: 34px;
    height: 34px;
    color: #C1C5CC;
  }

  .cs-logo-placeholder span {
    font-size: 10px;
  }

  .cs-logo-controls {
    min-width: 0;
  }

  .cs-logo-controls h3 {
    margin: 0;
    color: #30343B;
    font-size: 13px;
    font-weight: 700;
  }

  .cs-logo-controls > p {
    margin: 5px 0 15px;
    color: #858A94;
    font-size: 10px;
    line-height: 1.5;
  }

  .cs-logo-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .cs-file-input-wrap {
    position: relative;
    display: inline-flex;
    overflow: hidden;
  }

  .cs-file-input-wrap input[type="file"] {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .cs-logo-file {
    margin-top: 10px;
    color: #969BA5;
    font-family: monospace;
    font-size: 9px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .cs-logo-error {
    margin-top: 9px;
    padding: 8px 10px;
    border: 1px solid #F3D1D1;
    border-radius: 7px;
    background: #FDEEEE;
    color: #C94B4B;
    font-size: 10px;
    line-height: 1.45;
  }

  /* =======================================================
     Buttons
  ======================================================= */

  .cs-btn {
    min-height: 38px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 0 13px;
    border-radius: 8px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 680;
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease,
      transform 0.15s ease;
  }

  .cs-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .cs-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .cs-btn svg {
    width: 15px;
    height: 15px;
  }

  .cs-btn-primary {
    border: 1px solid #3567D6;
    background: #3567D6;
    color: #FFFFFF;
    box-shadow: 0 2px 5px rgba(53, 103, 214, 0.14);
  }

  .cs-btn-primary:hover:not(:disabled) {
    background: #2F5FC9;
  }

  .cs-btn-secondary {
    border: 1px solid #DFE2E7;
    background: #FFFFFF;
    color: #555B65;
  }

  .cs-btn-secondary:hover:not(:disabled) {
    border-color: #CFD3DA;
    background: #F6F7F9;
  }

  .cs-btn-danger {
    border: 1px solid #F0D2D2;
    background: #FDEEEE;
    color: #C94B4B;
  }

  .cs-btn-danger:hover:not(:disabled) {
    border-color: #E9BEBE;
    background: #FBE5E5;
  }

  /* =======================================================
     Address
  ======================================================= */

  .cs-address-grid {
    display: grid;
    grid-template-columns: minmax(0, 2fr) repeat(3, minmax(0, 1fr));
    gap: 15px;
  }

  /* =======================================================
     Save bar
  ======================================================= */

  .cs-save-bar {
    grid-column: 1 / -1;
    position: sticky;
    bottom: 14px;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    margin-top: 2px;
    padding: 12px 14px;
    border: 1px solid #E0E3E8;
    border-radius: 11px;
    background: rgba(255, 255, 255, 0.94);
    box-shadow: 0 8px 28px rgba(20, 24, 32, 0.08);
    backdrop-filter: blur(14px);
  }

  .cs-save-message {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #737984;
    font-size: 10px;
  }

  .cs-save-message svg {
    width: 15px;
    height: 15px;
    color: #16845B;
  }

  .cs-save-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* =======================================================
     Loading
  ======================================================= */

  .cs-skeleton {
    border-radius: 8px;
    background: linear-gradient(
      90deg,
      #EEF0F3 25%,
      #F7F8F9 50%,
      #EEF0F3 75%
    );
    background-size: 200% 100%;
    animation: cs-shimmer 1.5s infinite;
  }

  @keyframes cs-shimmer {
    from {
      background-position: 200% 0;
    }

    to {
      background-position: -200% 0;
    }
  }

  .cs-loading-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .cs-loading-card {
    min-height: 220px;
    padding: 21px;
    border: 1px solid #E7E9ED;
    border-radius: 14px;
    background: #FFFFFF;
  }

  /* =======================================================
     Responsive
  ======================================================= */

  @media (max-width: 1150px) {
    .cs-overview {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .cs-company-overview {
      grid-column: 1 / -1;
    }

    .cs-address-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .cs-address-grid .cs-field-full {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 900px) {
    .cs-grid {
      grid-template-columns: 1fr;
    }

    .cs-full {
      grid-column: 1;
    }

    .cs-overview {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .cs-company-overview {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 680px) {
    .cs-root {
      padding: 20px 15px 90px;
    }

    .cs-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .cs-header-status {
      align-self: flex-start;
    }

    .cs-overview {
      grid-template-columns: 1fr;
    }

    .cs-company-overview {
      grid-column: 1;
    }

    .cs-card {
      padding: 17px;
    }

    .cs-logo-layout {
      grid-template-columns: 1fr;
    }

    .cs-logo-preview {
      width: 100%;
      height: 170px;
    }

    .cs-fields {
      grid-template-columns: 1fr;
    }

    .cs-field-full {
      grid-column: 1;
    }

    .cs-address-grid {
      grid-template-columns: 1fr;
    }

    .cs-address-grid .cs-field-full {
      grid-column: 1;
    }

    .cs-save-bar {
      flex-direction: column;
      align-items: stretch;
      bottom: 8px;
    }

    .cs-save-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }

    .cs-save-actions .cs-btn {
      width: 100%;
    }
  }

  @media (max-width: 430px) {
    .cs-save-actions {
      grid-template-columns: 1fr;
    }

    .cs-logo-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .cs-logo-actions > *,
    .cs-logo-actions .cs-btn {
      width: 100%;
    }

    .cs-file-input-wrap {
      width: 100%;
    }
  }
`;

/* =========================================================
   Component
========================================================= */

export default function CompanySettings() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [company, setCompany] = useState(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    gstNumber: "",
    panNumber: "",
    website: "",
  });

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoChanged, setLogoChanged] = useState(false);
  const [logoError, setLogoError] = useState(false);

  /* =========================================================
     Logo URL helper
  ========================================================= */

  const getLogoUrl = (logoPath) => {
    if (!logoPath) return null;

    if (
      logoPath.startsWith("http://") ||
      logoPath.startsWith("https://")
    ) {
      return logoPath;
    }

    const baseUrl =
      import.meta.env.VITE_API_BASE_URL ||
      "http://localhost:5000/api/v1";

    const rootUrl = baseUrl
      .replace(/\/api\/v1\/?$/, "")
      .replace(/\/+$/, "");

    const path = logoPath.startsWith("/")
      ? logoPath
      : `/${logoPath}`;

    return `${rootUrl}${path}`;
  };

  /* =========================================================
     Load company
  ========================================================= */

  const loadCompany = async () => {
    setLoading(true);
    setLogoError(false);

    try {
      const companyId = user?.company_id;

      if (!companyId) {
        toast.error("Company ID not found");
        setLoading(false);
        return;
      }

      const res = await companyAPI.getById(companyId);

      const data =
        res.data?.data ||
        res.data?.company ||
        res.data;

      if (!data) {
        throw new Error("Company data not found");
      }

      setCompany(data);

      setForm({
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        address: data.address || "",
        city: data.city || "",
        state: data.state || "",
        pincode: data.pincode || "",
        gstNumber:
          data.gst_number ||
          data.gstNumber ||
          "",
        panNumber:
          data.pan_number ||
          data.panNumber ||
          "",
        website: data.website || "",
      });

      if (data.logo) {
        setLogoPreview(
          getLogoUrl(data.logo),
        );
      } else {
        setLogoPreview(null);
      }

      setLogoFile(null);
      setLogoChanged(false);
    } catch (err) {
      console.error(
        "Error loading company:",
        err,
      );

      toast.error(
        err?.response?.data?.message ||
          "Failed to load company details",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.company_id) {
      loadCompany();
    }
  }, [user?.company_id]);

  /* =========================================================
     Form change
  ========================================================= */

  const handleChange = (field) => (e) => {
    setForm((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  /* =========================================================
     Logo change
  ========================================================= */

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ];

    if (!validTypes.includes(file.type)) {
      toast.error(
        "Please upload a valid image: JPEG, PNG, GIF, WEBP or SVG",
      );

      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(
        "Image must be less than 5MB",
      );

      e.target.value = "";
      return;
    }

    setLogoFile(file);
    setLogoChanged(true);
    setLogoError(false);

    const reader = new FileReader();

    reader.onload = (event) => {
      setLogoPreview(
        event.target?.result || null,
      );
    };

    reader.readAsDataURL(file);
  };

  /* =========================================================
     FormData helper
  ========================================================= */

  const appendCompanyFields = (
    formData,
  ) => {
    formData.append(
      "name",
      form.name,
    );

    formData.append(
      "email",
      form.email,
    );

    formData.append(
      "phone",
      form.phone,
    );

    formData.append(
      "address",
      form.address,
    );

    formData.append(
      "city",
      form.city,
    );

    formData.append(
      "state",
      form.state,
    );

    formData.append(
      "pincode",
      form.pincode,
    );

    formData.append(
      "gstNumber",
      form.gstNumber,
    );

    formData.append(
      "panNumber",
      form.panNumber,
    );

    formData.append(
      "website",
      form.website,
    );
  };

  /* =========================================================
     Save logo
  ========================================================= */

  const handleSaveLogo = async () => {
    if (!logoFile) {
      toast.error(
        "Please select a logo file first",
      );
      return;
    }

    setUploadingLogo(true);

    try {
      const companyId =
        user?.company_id;

      if (!companyId) {
        toast.error(
          "Company ID not found",
        );
        return;
      }

      const formData =
        new FormData();

      formData.append(
        "logo",
        logoFile,
      );

      appendCompanyFields(
        formData,
      );

      const res =
        await companyAPI.update(
          companyId,
          formData,
        );

      toast.success(
        "Company logo updated successfully",
      );

      const newLogo =
        res.data?.data?.logo ||
        res.data?.logo;

      if (newLogo) {
        setLogoPreview(
          getLogoUrl(newLogo),
        );
      }

      setLogoFile(null);
      setLogoChanged(false);
      setLogoError(false);

      await loadCompany();
    } catch (err) {
      console.error(
        "Error uploading logo:",
        err,
      );

      toast.error(
        err?.response?.data?.message ||
          "Failed to upload logo",
      );
    } finally {
      setUploadingLogo(false);
    }
  };

  /* =========================================================
     Cancel selected logo
  ========================================================= */

  const handleCancelLogo = () => {
    setLogoFile(null);
    setLogoChanged(false);
    setLogoError(false);

    setLogoPreview(
      company?.logo
        ? getLogoUrl(company.logo)
        : null,
    );
  };

  /* =========================================================
     Remove logo
  ========================================================= */

  const handleRemoveLogo = async () => {
    if (
      !window.confirm(
        "Are you sure you want to remove the company logo?",
      )
    ) {
      return;
    }

    setUploadingLogo(true);

    try {
      const companyId =
        user?.company_id;

      if (!companyId) {
        toast.error(
          "Company ID not found",
        );
        return;
      }

      const formData =
        new FormData();

      /*
       * Keep the original behavior.
       * The backend can interpret an empty logo
       * as a request to remove it.
       */
      formData.append(
        "logo",
        "",
      );

      appendCompanyFields(
        formData,
      );

      await companyAPI.update(
        companyId,
        formData,
      );

      toast.success(
        "Company logo removed successfully",
      );

      setLogoPreview(null);
      setLogoFile(null);
      setLogoChanged(false);
      setLogoError(false);

      await loadCompany();
    } catch (err) {
      console.error(
        "Error removing logo:",
        err,
      );

      toast.error(
        err?.response?.data?.message ||
          "Failed to remove logo",
      );
    } finally {
      setUploadingLogo(false);
    }
  };

  /* =========================================================
     Has changes
  ========================================================= */

  const hasChanges = () => {
    if (!company) {
      return false;
    }

    const fields = [
      "name",
      "email",
      "phone",
      "address",
      "city",
      "state",
      "pincode",
      "gstNumber",
      "panNumber",
      "website",
    ];

    for (const field of fields) {
      const currentValue =
        form[field] || "";

      let originalValue = "";

      if (field === "gstNumber") {
        originalValue =
          company.gst_number ||
          company.gstNumber ||
          "";
      } else if (
        field === "panNumber"
      ) {
        originalValue =
          company.pan_number ||
          company.panNumber ||
          "";
      } else {
        originalValue =
          company[field] || "";
      }

      if (
        String(currentValue) !==
        String(originalValue)
      ) {
        return true;
      }
    }

    if (logoFile) {
      return true;
    }

    return false;
  };

  /* =========================================================
     Save all settings
  ========================================================= */

  const handleSave = async () => {
    if (logoFile) {
      await handleSaveLogo();
      return;
    }

    setSaving(true);

    try {
      const companyId =
        user?.company_id;

      if (!companyId) {
        toast.error(
          "Company ID not found",
        );
        return;
      }

      await companyAPI.update(
        companyId,
        {
          name: form.name,
          email: form.email,
          phone: form.phone,
          address: form.address,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          gstNumber:
            form.gstNumber,
          panNumber:
            form.panNumber,
          website: form.website,
        },
      );

      toast.success(
        "Company settings updated successfully",
      );

      await loadCompany();

      setLogoFile(null);
      setLogoChanged(false);
      setLogoError(false);
    } catch (err) {
      console.error(
        "Error saving settings:",
        err,
      );

      toast.error(
        err?.response?.data?.message ||
          "Failed to update settings",
      );
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     Cancel changes
  ========================================================= */

  const handleCancel = async () => {
    setLogoFile(null);
    setLogoChanged(false);
    setLogoError(false);

    await loadCompany();
  };

  /* =========================================================
     Loading
  ========================================================= */

  if (loading) {
    return (
      <div className="cs-root">
        <style>{CSS}</style>

        <div className="cs-shell">

          <div className="cs-header">
            <div>
              <div className="cs-eyebrow">
                Organization management
              </div>

              <h1>
                Company settings
              </h1>

              <p>
                Loading company profile...
              </p>
            </div>
          </div>

          <div className="cs-loading-grid">

            {[1, 2, 3, 4].map(
              (item) => (
                <div
                  className="cs-loading-card"
                  key={item}
                >
                  <div
                    className="cs-skeleton"
                    style={{
                      height: 18,
                      width: "45%",
                      marginBottom: 18,
                    }}
                  />

                  <div
                    className="cs-skeleton"
                    style={{
                      height: 42,
                      width: "100%",
                      marginBottom: 14,
                    }}
                  />

                  <div
                    className="cs-skeleton"
                    style={{
                      height: 42,
                      width: "100%",
                      marginBottom: 14,
                    }}
                  />

                  <div
                    className="cs-skeleton"
                    style={{
                      height: 42,
                      width: "70%",
                    }}
                  />
                </div>
              ),
            )}

          </div>
        </div>
      </div>
    );
  }

  /* =========================================================
     Render
  ========================================================= */

  return (
    <div className="cs-root">
      <style>{CSS}</style>

      <div className="cs-shell">

        {/* =================================================
            Header
        ================================================= */}

        <header className="cs-header">

          <div>
            <div className="cs-eyebrow">
              Organization management
            </div>

            <h1>
              Company settings
            </h1>

            <p>
              Manage your company profile,
              branding and registration details.
            </p>
          </div>

          <div className="cs-header-status">
            <CheckCircleIcon />
            Company profile
          </div>

        </header>

        {/* =================================================
            Overview
        ================================================= */}

        <section className="cs-overview">

          {/* Company */}

          <div className="cs-company-overview">

            <div className="cs-overview-logo">

              {logoPreview &&
              !logoError ? (
                <img
                  src={logoPreview}
                  alt="Company logo"
                  onError={() => {
                    setLogoError(true);
                  }}
                />
              ) : (
                <BuildingOffice2Icon />
              )}

            </div>

            <div className="cs-overview-company">

              <strong>
                {form.name ||
                  "Your company"}
              </strong>

              <span>
                {form.email ||
                  "Company email not configured"}
              </span>

            </div>

          </div>

          {/* Email */}

          <div className="cs-stat-card">

            <div className="cs-stat-icon blue">
              <EnvelopeIcon />
            </div>

            <div className="cs-stat-content">
              <span>
                Contact email
              </span>

              <strong>
                {form.email ||
                  "Not configured"}
              </strong>
            </div>

          </div>

          {/* Phone */}

          <div className="cs-stat-card">

            <div className="cs-stat-icon green">
              <PhoneIcon />
            </div>

            <div className="cs-stat-content">
              <span>
                Phone
              </span>

              <strong>
                {form.phone ||
                  "Not configured"}
              </strong>
            </div>

          </div>

          {/* Location */}

          <div className="cs-stat-card">

            <div className="cs-stat-icon orange">
              <MapPinIcon />
            </div>

            <div className="cs-stat-content">
              <span>
                Location
              </span>

              <strong>
                {form.city ||
                  form.state ||
                  "Not configured"}
              </strong>
            </div>

          </div>

        </section>

        {/* =================================================
            Main settings
        ================================================= */}

        <div className="cs-grid">

          {/* =================================================
              Company Logo
          ================================================= */}

          <section className="cs-card cs-logo-card">

            <div className="cs-card-header">

              <div className="cs-card-title">

                <div className="cs-card-title-icon">
                  <BuildingOffice2Icon />
                </div>

                <div className="cs-card-title-copy">

                  <h2>
                    Company branding
                  </h2>

                  <p>
                    Upload the logo used across
                    your organization.
                  </p>

                </div>

              </div>

            </div>

            <div className="cs-logo-layout">

              <div className="cs-logo-preview">

                {logoPreview &&
                !logoError ? (
                  <img
                    src={logoPreview}
                    alt="Company logo"
                    onError={() =>
                      setLogoError(true)
                    }
                  />
                ) : (
                  <div className="cs-logo-placeholder">
                    <BuildingOffice2Icon />

                    <span>
                      {logoError
                        ? "Unable to load logo"
                        : "No logo uploaded"}
                    </span>
                  </div>
                )}

              </div>

              <div className="cs-logo-controls">

                <h3>
                  Company logo
                </h3>

                <p>
                  Use a square or horizontal logo
                  with a clear background. Maximum
                  file size is 5MB.
                </p>

                <div className="cs-logo-actions">

                  {/* Upload */}

                  <div className="cs-file-input-wrap">

                    <button
                      type="button"
                      className="cs-btn cs-btn-primary"
                      disabled={
                        saving ||
                        uploadingLogo
                      }
                    >
                      <CloudArrowUpIcon />

                      {uploadingLogo
                        ? "Uploading..."
                        : "Upload logo"}
                    </button>

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                      onChange={
                        handleLogoChange
                      }
                      disabled={
                        saving ||
                        uploadingLogo
                      }
                    />

                  </div>

                  {/* Cancel selected logo */}

                  {logoFile && (
                    <button
                      type="button"
                      className="cs-btn cs-btn-secondary"
                      onClick={
                        handleCancelLogo
                      }
                      disabled={
                        saving ||
                        uploadingLogo
                      }
                    >
                      <XMarkIcon />
                      Cancel
                    </button>
                  )}

                  {/* Save logo */}

                  {logoFile && (
                    <button
                      type="button"
                      className="cs-btn cs-btn-primary"
                      onClick={
                        handleSaveLogo
                      }
                      disabled={
                        uploadingLogo
                      }
                    >
                      {uploadingLogo
                        ? "Uploading..."
                        : "Save logo"}
                    </button>
                  )}

                  {/* Remove */}

                  {company?.logo &&
                    !logoFile && (
                      <button
                        type="button"
                        className="cs-btn cs-btn-danger"
                        onClick={
                          handleRemoveLogo
                        }
                        disabled={
                          saving ||
                          uploadingLogo
                        }
                      >
                        <TrashIcon />
                        Remove
                      </button>
                    )}

                </div>

                {company?.logo && (
                  <div className="cs-logo-file">
                    {company.logo
                      .split("/")
                      .pop()}
                  </div>
                )}

                {logoError &&
                  company?.logo && (
                    <div className="cs-logo-error">
                      The current logo could not
                      be loaded from the server.
                      Please upload it again.
                    </div>
                  )}

              </div>

            </div>

          </section>

          {/* =================================================
              Company details
          ================================================= */}

          <section className="cs-card">

            <div className="cs-card-header">

              <div className="cs-card-title">

                <div className="cs-card-title-icon">
                  <IdentificationIcon />
                </div>

                <div className="cs-card-title-copy">

                  <h2>
                    Company information
                  </h2>

                  <p>
                    Basic organization contact
                    information.
                  </p>

                </div>

              </div>

            </div>

            <div className="cs-fields">

              <div className="cs-field cs-field-full">

                <label className="cs-label">
                  Company name
                </label>

                <input
                  className="cs-input"
                  value={form.name}
                  onChange={handleChange(
                    "name",
                  )}
                  placeholder="Your company name"
                />

              </div>

              <div className="cs-field">

                <label className="cs-label">
                  Email
                </label>

                <input
                  className="cs-input"
                  value={form.email}
                  onChange={handleChange(
                    "email",
                  )}
                  placeholder="contact@company.com"
                  type="email"
                />

              </div>

              <div className="cs-field">

                <label className="cs-label">
                  Phone
                </label>

                <input
                  className="cs-input"
                  value={form.phone}
                  onChange={handleChange(
                    "phone",
                  )}
                  placeholder="+91 98765 43210"
                  type="tel"
                />

              </div>

              <div className="cs-field cs-field-full">

                <label className="cs-label">
                  Website
                </label>

                <input
                  className="cs-input"
                  value={form.website}
                  onChange={handleChange(
                    "website",
                  )}
                  placeholder="https://company.com"
                  type="url"
                />

              </div>

            </div>

          </section>

          {/* =================================================
              Address
          ================================================= */}

          <section className="cs-card cs-full">

            <div className="cs-card-header">

              <div className="cs-card-title">

                <div className="cs-card-title-icon green">
                  <MapPinIcon />
                </div>

                <div className="cs-card-title-copy">

                  <h2>
                    Business address
                  </h2>

                  <p>
                    Registered office and company
                    location information.
                  </p>

                </div>

              </div>

            </div>

            <div className="cs-address-grid">

              <div className="cs-field cs-field-full">

                <label className="cs-label">
                  Street address
                </label>

                <textarea
                  className="cs-input cs-textarea"
                  value={form.address}
                  onChange={handleChange(
                    "address",
                  )}
                  placeholder="Business park, building, street or office address"
                />

              </div>

              <div className="cs-field">

                <label className="cs-label">
                  City
                </label>

                <input
                  className="cs-input"
                  value={form.city}
                  onChange={handleChange(
                    "city",
                  )}
                  placeholder="Mumbai"
                />

              </div>

              <div className="cs-field">

                <label className="cs-label">
                  State
                </label>

                <input
                  className="cs-input"
                  value={form.state}
                  onChange={handleChange(
                    "state",
                  )}
                  placeholder="Maharashtra"
                />

              </div>

              <div className="cs-field">

                <label className="cs-label">
                  Pincode
                </label>

                <input
                  className="cs-input"
                  value={form.pincode}
                  onChange={handleChange(
                    "pincode",
                  )}
                  placeholder="400001"
                />

              </div>

            </div>

          </section>

          {/* =================================================
              Tax & Registration
          ================================================= */}

          <section className="cs-card cs-full">

            <div className="cs-card-header">

              <div className="cs-card-title">

                <div className="cs-card-title-icon orange">
                  <DocumentTextIcon />
                </div>

                <div className="cs-card-title-copy">

                  <h2>
                    Tax & registration
                  </h2>

                  <p>
                    Business identification and
                    statutory registration details.
                  </p>

                </div>

              </div>

            </div>

            <div className="cs-fields">

              <div className="cs-field">

                <label className="cs-label">
                  GST number
                </label>

                <input
                  className="cs-input"
                  value={
                    form.gstNumber
                  }
                  onChange={handleChange(
                    "gstNumber",
                  )}
                  placeholder="22AAAAA0000A1Z5"
                />

              </div>

              <div className="cs-field">

                <label className="cs-label">
                  PAN number
                </label>

                <input
                  className="cs-input"
                  value={
                    form.panNumber
                  }
                  onChange={handleChange(
                    "panNumber",
                  )}
                  placeholder="AAAAA1234A"
                />

              </div>

            </div>

          </section>

          {/* =================================================
              Save bar
          ================================================= */}

          <div className="cs-save-bar">

            <div className="cs-save-message">

              <CheckCircleIcon />

              {hasChanges()
                ? "You have unsaved changes"
                : "All company settings are saved"}

            </div>

            <div className="cs-save-actions">

              <button
                type="button"
                className="cs-btn cs-btn-secondary"
                onClick={handleCancel}
                disabled={
                  saving ||
                  uploadingLogo ||
                  !hasChanges()
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="cs-btn cs-btn-primary"
                onClick={handleSave}
                disabled={
                  saving ||
                  uploadingLogo ||
                  !hasChanges()
                }
              >
                <PencilIcon />

                {saving
                  ? "Saving..."
                  : uploadingLogo
                    ? "Uploading..."
                    : "Save changes"}
              </button>

            </div>

          </div>

        </div>
      </div>
    </div>
  );
}