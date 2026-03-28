import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import Navbar from '../components/common/Navbar';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <>
      <style>{`
  .layout-root {
    display: flex;
    height: 100vh;
    background: #f8f8fc;
  }

  .layout-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: margin-left 0.28s cubic-bezier(.4,0,.2,1);
    margin-left: ${true ? '232px' : '0'};
  }

  .layout-content {
    flex: 1;
    overflow-y: auto;

    /* Hide scrollbar */
    scrollbar-width: none;        /* Firefox */
    -ms-overflow-style: none;     /* IE & Edge */
  }

  .layout-content::-webkit-scrollbar {
    display: none;                /* Chrome, Safari */
  }

  @media (max-width: 1024px) {
    .layout-main {
      margin-left: 0 !important;
      padding-bottom: 64px;
    }
  }
`}</style>

      <div className="layout-root">
        {/* Sidebar — hidden on mobile/tablet via its own media query */}
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div
          className="layout-main"
          style={{ marginLeft: sidebarOpen ? 232 : 0 }}
        >
          <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          <main className="layout-content">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}