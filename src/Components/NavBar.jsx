import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { FaGithub, FaSignOutAlt, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { colors } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';

const Nav = styled.nav`
  background-color: ${colors.background.tertiary};
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px ${colors.additional.shadow};
  position: sticky;
  top: 0;
  z-index: 1000;
`;

const Logo = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: ${colors.text.primary};
  font-size: 1.5rem;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.2s;
  
  &:hover {
    color: ${colors.ui.primary};
    transform: scale(1.05);
  }
  
  svg {
    font-size: 1.8rem;
  }
`;

const NavLinks = styled.div`
  display: flex;
  gap: 2rem;
  align-items: center;
`;

const ProfileButton = styled.button`
  cursor: pointer;
  font-weight: 700;
  transition: all 0.2s;
  padding: 0.5rem 1rem;
  border-radius: 100px;
  background: ${colors.ui.primary};
  color: white;
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  font-size: 0.9rem;
  text-decoration: none;
  
  &:hover {
    background: ${colors.ui.primaryHover};
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  span {
    margin-right: 0.75rem;
  }
  
  img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    transition: transform 0.3s ease-in-out;
    margin-right: 0.5rem;
  }
  
  svg {
    margin-left: 0.5rem;
    transition: transform 0.2s ease;
  }
  
  &:hover img {
    transform: translateX(3px);
  }
`;

const DropdownMenu = styled.div`
  position: absolute;
  top: 100%;
  right: 2rem;
  background: ${colors.background.secondary};
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  width: 240px;
  padding: 0.5rem 0;
  margin-top: 0.5rem;
  z-index: 1000;
  border: 1px solid ${colors.ui.border};
  opacity: 0;
  transform: translateY(-10px);
  visibility: hidden;
  transition: all 0.2s ease;
  
  ${({ $isOpen }) => $isOpen && `
    opacity: 1;
    transform: translateY(0);
    visibility: visible;
  `}
`;

const DropdownHeader = styled.div`
  padding: 0.75rem 1rem;
  border-bottom: 1px solid ${colors.ui.border};
  
  div:first-child {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }
  
  div:last-child {
    font-size: 0.875rem;
    color: ${colors.text.secondary};
  }
`;

const DropdownItem = styled.button`
  width: 100%;
  text-align: left;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  color: ${colors.text.primary};
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: 0.9rem;
  transition: all 0.2s;
  
  &:hover {
    background: ${colors.state.hover};
  }
  
  svg {
    margin-right: 0.75rem;
    color: ${colors.text.secondary};
  }
`;

const ProfileContainer = styled.div`
  position: relative;
  display: inline-block;
`;

const NavBar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  
  // Don't render anything if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleSignOut = () => {
    logout();
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <Nav>
      <Logo to="/">
        <FaGithub />
      </Logo>
      <NavLinks>
        <ProfileContainer ref={dropdownRef}>
          <ProfileButton onClick={toggleDropdown}>
            {user.avatar && (
              <img
                src={user.avatar}
                alt="Profile"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name || 'U') + '&background=random';
                }}
              />
            )}
            <span>{user.name || user.username || 'User'}</span>
            {isOpen ? <FaChevronUp size={14} /> : <FaChevronDown size={14} />}
          </ProfileButton>
          
          <DropdownMenu $isOpen={isOpen}>
            <DropdownHeader>
              <div>{user.name || 'GitHub User'}</div>
              <div>@{user.username || 'user'}</div>
              {user.email && <div>{user.email}</div>}
            </DropdownHeader>
            <DropdownItem onClick={handleSignOut}>
              <FaSignOutAlt />

              Sign out
            </DropdownItem>
          </DropdownMenu>
        </ProfileContainer>
      </NavLinks>
    </Nav>
  );
};

export default NavBar;