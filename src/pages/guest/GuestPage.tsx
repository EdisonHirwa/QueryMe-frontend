import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardLayout from '../../layout/DashboardLayout';
import type { NavItem } from '../../layout/DashboardLayout';
import GuestHome from './GuestHome';
import PublicCatalog from './PublicCatalog';
import GuestProfile from './GuestProfile';

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);

const guestNav: NavItem[] = [
  { label: 'Home', path: '/guest', icon: <HomeIcon /> },
  { label: 'Course Catalog', path: '/guest/catalog', icon: <EyeIcon /> },
];

const GuestPage: React.FC = () => {
  return (
    <DashboardLayout navItems={guestNav} portalTitle="Guest View" accentColor="#718096">
      <Routes>
        <Route index element={<GuestHome />} />
        <Route path="catalog" element={<PublicCatalog />} />
        <Route path="profile" element={<GuestProfile />} />
        <Route path="*" element={<Navigate to="/guest" replace />} />
      </Routes>
    </DashboardLayout>
  );
};

export default GuestPage;
