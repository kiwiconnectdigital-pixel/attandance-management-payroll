// src/pages/settings/CompanySettings.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { companyAPI } from '../../services/api';
import toast from 'react-hot-toast';
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
} from '@heroicons/react/24/outline';

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

.cs-root {
  font-family: 'DM Sans', system-ui, sans-serif;
  background: #0f1623;
  color: #f0f4ff;
  min-height: 100vh;
  padding: 28px 20px 100px;
  -webkit-font-smoothing: antialiased;
}
.cs-root * { box-sizing: border-box; margin: 0; padding: 0; }

.cs-header { margin-bottom: 28px; }
.cs-header h1 { 
  font-size: clamp(24px, 4vw, 30px); 
  font-weight: 700; 
  letter-spacing: -0.4px;
  background: linear-gradient(135deg, #f0f4ff, #93c5fd);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.cs-header p { 
  font-size: 13px; 
  color: #5a6a85; 
  margin-top: 4px;
}

.cs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.cs-card {
  background: rgba(26,35,54,0.85);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 18px;
  padding: 24px;
  transition: border-color 0.2s;
}
.cs-card:hover {
  border-color: rgba(79,142,255,0.15);
}

.cs-card-title {
  font-size: 13px;
  font-weight: 600;
  color: #f0f4ff;
  margin-bottom: 18px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.cs-card-title svg {
  width: 18px;
  height: 18px;
  color: #4f8eff;
}

.cs-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}
.cs-field:last-child { margin-bottom: 0; }

.cs-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: rgba(255,255,255,0.35);
}

.cs-input {
  width: 100%;
  padding: 10px 14px;
  background: rgba(15,22,35,0.7);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  color: #f0f4ff;
  font-size: 14px;
  font-family: 'DM Sans', system-ui, sans-serif;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.cs-input:focus {
  border-color: rgba(79,142,255,0.5);
  box-shadow: 0 0 0 3px rgba(79,142,255,0.08);
}
.cs-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.cs-input::placeholder {
  color: rgba(255,255,255,0.2);
}

.cs-logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 10px 0;
}

.cs-logo-preview {
  width: 140px;
  height: 140px;
  border-radius: 16px;
  border: 2px dashed rgba(255,255,255,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: rgba(15,22,35,0.5);
  position: relative;
}
.cs-logo-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.cs-logo-preview .placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #5a6a85;
}
.cs-logo-preview .placeholder svg {
  width: 48px;
  height: 48px;
  opacity: 0.4;
}
.cs-logo-preview .placeholder span {
  font-size: 12px;
}

.cs-logo-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: center;
}

.cs-file-input-wrap {
  position: relative;
  overflow: hidden;
  display: inline-block;
}
.cs-file-input-wrap input[type="file"] {
  position: absolute;
  left: 0;
  top: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}

.cs-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.cs-btn:active { transform: scale(0.97); }
.cs-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.cs-btn-primary {
  background: linear-gradient(135deg, #4f8eff, #6366f1);
  color: #fff;
  box-shadow: 0 4px 16px rgba(79,142,255,0.25);
}
.cs-btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(79,142,255,0.35);
}

.cs-btn-secondary {
  background: rgba(255,255,255,0.08);
  color: #8b9ab5;
  border: 1px solid rgba(255,255,255,0.1);
}
.cs-btn-secondary:hover:not(:disabled) {
  background: rgba(255,255,255,0.14);
  color: #f0f4ff;
}

.cs-btn-danger {
  background: rgba(239,68,68,0.12);
  color: #f87171;
  border: 1px solid rgba(239,68,68,0.2);
}
.cs-btn-danger:hover:not(:disabled) {
  background: rgba(239,68,68,0.22);
}

.cs-full { grid-column: 1 / -1; }

.cs-save-bar {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin: 20px -20px -28px;
  padding: 16px 20px;
  background: rgba(15,22,35,0.95);
  backdrop-filter: blur(16px);
  border-top: 1px solid rgba(255,255,255,0.07);
  border-radius: 0 0 18px 18px;
}

.cs-skeleton {
  animation: cs-pulse 1.5s infinite;
  background: rgba(255,255,255,0.05);
  border-radius: 8px;
}
@keyframes cs-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.cs-logo-filename {
  font-size: 10px;
  color: rgba(255,255,255,0.2);
  margin-top: 2px;
  font-family: 'DM Mono', monospace;
  word-break: break-all;
  text-align: center;
  max-width: 100%;
}

@media (max-width: 820px) {
  .cs-grid { grid-template-columns: 1fr; }
  .cs-full { grid-column: 1; }
}

@media (max-width: 480px) {
  .cs-root { padding: 20px 14px 100px; }
  .cs-card { padding: 18px 16px; }
  .cs-logo-preview { width: 100px; height: 100px; }
  .cs-save-bar { 
    flex-direction: column-reverse;
    margin: 16px -16px -18px;
    padding: 14px 16px;
  }
  .cs-save-bar .cs-btn { 
    width: 100%; 
    justify-content: center;
  }
}
`;

export default function CompanySettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [company, setCompany] = useState(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gstNumber: '',
    panNumber: '',
    website: '',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoChanged, setLogoChanged] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // ✅ Helper: Get full logo URL from stored path
  const getLogoUrl = (logoPath) => {
    if (!logoPath) return null;
    
    // If it's already a full URL, return as is
    if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
      return logoPath;
    }
    
    // Get base URL from environment
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
    // Remove /api/v1 from baseUrl to get the root URL
    const rootUrl = baseUrl.replace('/api/v1', '');
    
    // Ensure logoPath starts with /
    const path = logoPath.startsWith('/') ? logoPath : `/${logoPath}`;
    
    return `${rootUrl}${path}`;
  };

  const loadCompany = async () => {
    setLoading(true);
    setLogoError(false);
    try {
      const companyId = user?.company_id;
      if (!companyId) {
        toast.error('Company ID not found');
        setLoading(false);
        return;
      }

      const res = await companyAPI.getById(companyId);
      const data = res.data.data;
      setCompany(data);
      setForm({
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        pincode: data.pincode || '',
        gstNumber: data.gst_number || data.gstNumber || '',
        panNumber: data.pan_number || data.panNumber || '',
        website: data.website || '',
      });
      
      // ✅ Set logo preview from server using full URL
      if (data.logo) {
        const fullUrl = getLogoUrl(data.logo);
        console.log('🖼️ Logo URL:', fullUrl);
        setLogoPreview(fullUrl);
      } else {
        setLogoPreview(null);
      }
      setLogoChanged(false);
    } catch (err) {
      console.error('❌ Error loading company:', err);
      toast.error(err.response?.data?.message || 'Failed to load company details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompany();
  }, [user]);

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image (JPEG, PNG, GIF, WEBP, SVG)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setLogoFile(file);
    setLogoChanged(true);
    setLogoError(false);
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleSaveLogo = async () => {
    if (!logoFile) {
      toast.error('Please select a logo file first');
      return;
    }

    setUploadingLogo(true);
    try {
      const companyId = user?.company_id;
      if (!companyId) {
        toast.error('Company ID not found');
        return;
      }

      const formData = new FormData();
      formData.append('logo', logoFile);

      // Also send all other fields to prevent data loss
      formData.append('name', form.name);
      formData.append('email', form.email);
      formData.append('phone', form.phone);
      formData.append('address', form.address);
      formData.append('city', form.city);
      formData.append('state', form.state);
      formData.append('pincode', form.pincode);
      formData.append('gstNumber', form.gstNumber);
      formData.append('panNumber', form.panNumber);
      formData.append('website', form.website);

      const res = await companyAPI.update(companyId, formData);
      
      toast.success('Logo updated successfully!');
      
      // ✅ Update logo preview with the new URL from server
      const newLogo = res.data?.data?.logo || res.data?.logo;
      if (newLogo) {
        setLogoPreview(getLogoUrl(newLogo));
      }
      setLogoFile(null);
      setLogoChanged(false);
      setLogoError(false);
      
      await loadCompany();
    } catch (err) {
      console.error('❌ Error uploading logo:', err);
      toast.error(err.response?.data?.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!confirm('Are you sure you want to remove the company logo?')) return;

    setUploadingLogo(true);
    try {
      const companyId = user?.company_id;
      if (!companyId) {
        toast.error('Company ID not found');
        return;
      }

      const formData = new FormData();
      formData.append('logo', '');

      formData.append('name', form.name);
      formData.append('email', form.email);
      formData.append('phone', form.phone);
      formData.append('address', form.address);
      formData.append('city', form.city);
      formData.append('state', form.state);
      formData.append('pincode', form.pincode);
      formData.append('gstNumber', form.gstNumber);
      formData.append('panNumber', form.panNumber);
      formData.append('website', form.website);

      await companyAPI.update(companyId, formData);
      
      toast.success('Logo removed successfully');
      setLogoPreview(null);
      setLogoFile(null);
      setLogoChanged(false);
      setLogoError(false);
      await loadCompany();
    } catch (err) {
      console.error('❌ Error removing logo:', err);
      toast.error(err.response?.data?.message || 'Failed to remove logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    if (logoFile && !logoChanged) {
      await handleSaveLogo();
      return;
    }

    setSaving(true);
    try {
      const companyId = user?.company_id;
      if (!companyId) {
        toast.error('Company ID not found');
        return;
      }

      if (logoFile) {
        const formData = new FormData();
        formData.append('logo', logoFile);
        formData.append('name', form.name);
        formData.append('email', form.email);
        formData.append('phone', form.phone);
        formData.append('address', form.address);
        formData.append('city', form.city);
        formData.append('state', form.state);
        formData.append('pincode', form.pincode);
        formData.append('gstNumber', form.gstNumber);
        formData.append('panNumber', form.panNumber);
        formData.append('website', form.website);
        
        await companyAPI.update(companyId, formData);
      } else {
        await companyAPI.update(companyId, {
          name: form.name,
          email: form.email,
          phone: form.phone,
          address: form.address,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          gstNumber: form.gstNumber,
          panNumber: form.panNumber,
          website: form.website,
        });
      }

      toast.success('Company settings updated successfully!');
      await loadCompany();
      setLogoFile(null);
      setLogoChanged(false);
    } catch (err) {
      console.error('❌ Error saving settings:', err);
      toast.error(err.response?.data?.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    loadCompany();
    setLogoFile(null);
    setLogoChanged(false);
    setLogoError(false);
  };

  const hasChanges = () => {
    if (!company) return false;
    const fields = ['name', 'email', 'phone', 'address', 'city', 'state', 'pincode', 'gstNumber', 'panNumber', 'website'];
    for (const field of fields) {
      const currentValue = form[field] || '';
      const originalValue = company[field] || '';
      if (currentValue !== originalValue) return true;
    }
    if (logoFile) return true;
    return false;
  };

  if (loading) {
    return (
      <div className="cs-root">
        <style>{CSS}</style>
        <div className="cs-header">
          <h1>Company Settings</h1>
          <p>Loading company details...</p>
        </div>
        <div className="cs-grid">
          {[1, 2].map(i => (
            <div key={i} className="cs-card" style={{ minHeight: 200 }}>
              <div className="cs-skeleton" style={{ height: 20, width: '60%', marginBottom: 16 }} />
              {[1, 2, 3].map(j => (
                <div key={j} className="cs-skeleton" style={{ height: 14, width: '100%', marginBottom: 10 }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="cs-root">
      <style>{CSS}</style>

      <div className="cs-header">
        <h1>Company Settings</h1>
        <p>Manage your company profile and branding</p>
      </div>

      <div className="cs-grid">
        {/* Logo Section */}
        <div className="cs-card">
          <div className="cs-card-title">
            <BuildingOffice2Icon />
            Company Logo
          </div>
          <div className="cs-logo-section">
            <div className="cs-logo-preview">
              {logoPreview && !logoError ? (
                <img 
                  src={logoPreview} 
                  alt="Company Logo" 
                  onError={() => {
                    console.error('❌ Logo failed to load:', logoPreview);
                    setLogoError(true);
                  }}
                />
              ) : (
                <div className="placeholder">
                  <BuildingOffice2Icon />
                  <span>{logoError ? 'Failed to load' : 'No logo'}</span>
                </div>
              )}
            </div>
            <div className="cs-logo-actions">
              <div className="cs-file-input-wrap">
                <button className="cs-btn cs-btn-primary" disabled={saving || uploadingLogo}>
                  <CloudArrowUpIcon style={{ width: 16, height: 16 }} />
                  {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                </button>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleLogoChange}
                  disabled={saving || uploadingLogo}
                />
              </div>
              
              {logoFile && (
                <button 
                  className="cs-btn cs-btn-secondary"
                  onClick={() => {
                    setLogoFile(null);
                    setLogoChanged(false);
                    setLogoError(false);
                    setLogoPreview(company?.logo ? getLogoUrl(company.logo) : null);
                  }}
                  disabled={saving || uploadingLogo}
                >
                  <XMarkIcon style={{ width: 16, height: 16 }} />
                  Cancel
                </button>
              )}

              {logoFile && (
                <button 
                  className="cs-btn cs-btn-primary"
                  onClick={handleSaveLogo}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? 'Uploading...' : 'Save Logo'}
                </button>
              )}

              {company?.logo && !logoFile && (
                <button 
                  className="cs-btn cs-btn-danger"
                  onClick={handleRemoveLogo}
                  disabled={saving || uploadingLogo}
                >
                  <TrashIcon style={{ width: 16, height: 16 }} />
                  Remove
                </button>
              )}
            </div>
            <p style={{ fontSize: 11, color: '#5a6a85', marginTop: 4 }}>
              Recommended: Square image, max 5MB (PNG, JPG, SVG)
            </p>
            {company?.logo && (
              <div className="cs-logo-filename">
                📄 {company.logo.split('/').pop()}
              </div>
            )}
            {logoError && company?.logo && (
              <p style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>
                ⚠️ Logo file not found on server. Please re-upload.
              </p>
            )}
          </div>
        </div>

        {/* Company Details */}
        <div className="cs-card">
          <div className="cs-card-title">
            <IdentificationIcon />
            Company Details
          </div>
          <div className="cs-field">
            <label className="cs-label">Company Name</label>
            <input
              className="cs-input"
              value={form.name}
              onChange={handleChange('name')}
              placeholder="Your company name"
            />
          </div>
          <div className="cs-field">
            <label className="cs-label">Email</label>
            <input
              className="cs-input"
              value={form.email}
              onChange={handleChange('email')}
              placeholder="contact@company.com"
              type="email"
            />
          </div>
          <div className="cs-field">
            <label className="cs-label">Phone</label>
            <input
              className="cs-input"
              value={form.phone}
              onChange={handleChange('phone')}
              placeholder="+91 98765 43210"
            />
          </div>
          <div className="cs-field">
            <label className="cs-label">Website</label>
            <input
              className="cs-input"
              value={form.website}
              onChange={handleChange('website')}
              placeholder="https://company.com"
            />
          </div>
        </div>

        {/* Address */}
        <div className="cs-card cs-full">
          <div className="cs-card-title">
            <MapPinIcon />
            Address
          </div>
          <div className="cs-field">
            <label className="cs-label">Street Address</label>
            <input
              className="cs-input"
              value={form.address}
              onChange={handleChange('address')}
              placeholder="123 Business Park, Main Road"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="cs-field">
              <label className="cs-label">City</label>
              <input
                className="cs-input"
                value={form.city}
                onChange={handleChange('city')}
                placeholder="Mumbai"
              />
            </div>
            <div className="cs-field">
              <label className="cs-label">State</label>
              <input
                className="cs-input"
                value={form.state}
                onChange={handleChange('state')}
                placeholder="Maharashtra"
              />
            </div>
            <div className="cs-field">
              <label className="cs-label">Pincode</label>
              <input
                className="cs-input"
                value={form.pincode}
                onChange={handleChange('pincode')}
                placeholder="400001"
              />
            </div>
          </div>
        </div>

        {/* Tax / Registration */}
        <div className="cs-card cs-full">
          <div className="cs-card-title">
            <DocumentTextIcon />
            Tax & Registration
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="cs-field">
              <label className="cs-label">GST Number</label>
              <input
                className="cs-input"
                value={form.gstNumber}
                onChange={handleChange('gstNumber')}
                placeholder="22AAAAA0000A1Z5"
              />
            </div>
            <div className="cs-field">
              <label className="cs-label">PAN Number</label>
              <input
                className="cs-input"
                value={form.panNumber}
                onChange={handleChange('panNumber')}
                placeholder="AAAAA1234A"
              />
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="cs-save-bar">
          <button 
            className="cs-btn cs-btn-secondary"
            onClick={handleCancel}
            disabled={saving || uploadingLogo}
          >
            Cancel
          </button>
          <button 
            className="cs-btn cs-btn-primary"
            onClick={handleSave}
            disabled={saving || uploadingLogo || !hasChanges()}
          >
            {saving ? (
              <>Saving…</>
            ) : uploadingLogo ? (
              <>Uploading Logo…</>
            ) : (
              <>
                <PencilIcon style={{ width: 16, height: 16 }} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}