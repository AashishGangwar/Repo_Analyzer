import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Bar, Pie, Line } from 'react-chartjs-2';
import { 
  FiUsers, 
  FiActivity, 
  FiGitBranch, 
  FiBarChart2,
  FiUser, 
  FiSettings, 
  FiLogOut, 
  FiMenu, 
  FiBell,
  FiStar, 
  FiGitCommit
} from 'react-icons/fi';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  ArcElement, 
  BarElement, 
  Tooltip as ChartTooltip, 
  Legend, 
  PointElement, 
  LineElement, 
  Title as ChartTitle 
} from 'chart.js';
import styled from 'styled-components';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  ArcElement,
  BarElement,
  PointElement,
  LineElement,
  ChartTitle,
  ChartTooltip,
  Legend
);

// Import theme colors
import { colors } from '../theme/colors';

// Extend colors with additional UI colors
const extendedColors = {
  ...colors,
  ui: {
    primary: colors.ui.primary,
    primaryHover: colors.ui.primaryHover,
    border: colors.ui.border,
  },
  state: {
    ...colors.state,
    hover: 'rgba(79, 70, 229, 0.1)'
  }
};

// Sample data for charts
const generateSampleData = () => ({
  userActivity: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
    datasets: [
      {
        label: 'Active Users',
        data: [65, 59, 80, 81, 56, 55, 40],
        backgroundColor: 'rgba(79, 70, 229, 0.2)',
        borderColor: '#4F46E5',
        borderWidth: 2,
        tension: 0.3,
        fill: true,
      },
    ],
  },
  repoStats: {
    labels: ['JavaScript', 'Python', 'TypeScript', 'Java', 'Go'],
    datasets: [
      {
        data: [35, 25, 20, 15, 5],
        backgroundColor: [
          'rgba(79, 70, 229, 0.7)',
          'rgba(16, 185, 129, 0.7)',
          'rgba(245, 158, 11, 0.7)',
          'rgba(239, 68, 68, 0.7)',
          'rgba(139, 92, 246, 0.7)',
        ],
        borderWidth: 1,
      },
    ],
  },
  performanceMetrics: {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Response Time (ms)',
        data: [120, 190, 130, 170, 150, 180, 140],
        borderColor: '#4F46E5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        tension: 0.3,
        fill: true,
      },
    ],
  },
});

const AdminDashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [chartData] = useState(generateSampleData());

  const stats = [
    { 
      id: 'users', 
      icon: <FiUsers className="text-blue-500" />, 
      title: 'Total Users', 
      value: '1,204', 
      change: 12.5,
      description: 'Active users this month'
    },
    { 
      id: 'active', 
      icon: <FiUser className="text-green-500" />, 
      title: 'Active Today', 
      value: '856', 
      change: 8.2,
      description: 'Users active in last 24h'
    },
    { 
      id: 'repos', 
      icon: <FiGitBranch className="text-purple-500" />, 
      title: 'Repos Analyzed', 
      value: '8,765', 
      change: -2.3,
      description: 'Total repositories analyzed'
    },
    { 
      id: 'performance', 
      icon: <FiActivity className="text-yellow-500" />, 
      title: 'Avg. Response', 
      value: '128ms', 
      change: -5.7,
      description: 'Average API response time'
    },
  ];

  const navItems = [
    { id: 'overview', label: 'Overview', icon: <FiActivity /> },
    { id: 'users', label: 'Users', icon: <FiUsers /> },
    { id: 'repos', label: 'Repositories', icon: <FiGitBranch /> },
    { id: 'analytics', label: 'Analytics', icon: <FiBarChart2 /> },
    { id: 'settings', label: 'Settings', icon: <FiSettings /> },
  ];

  const recentActivities = [
    { id: 1, user: 'John Doe', action: 'created a new repository', time: '2 minutes ago', icon: <FiGitBranch /> },
    { id: 2, user: 'Jane Smith', action: 'updated profile settings', time: '15 minutes ago', icon: <FiUser /> },
    { id: 3, user: 'Alex Johnson', action: 'pushed new commits', time: '1 hour ago', icon: <FiGitCommit /> },
    { id: 4, user: 'Sarah Wilson', action: 'starred a repository', time: '3 hours ago', icon: <FiStar /> },
  ];

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: extendedColors.text.secondary,
          padding: 20,
          usePointStyle: true,
          pointStyle: 'circle',
        }
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: extendedColors.text.secondary,
        },
      },
      y: {
        grid: {
          color: extendedColors.ui.border,
        },
        ticks: {
          color: extendedColors.text.secondary,
        },
      },
    },
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      logout();
      navigate('/admin/login');
    }
  };

  // Styled Components
  const PageContainer = styled.div`
    display: flex;
    min-height: 100vh;
    background-color: ${extendedColors.background.primary};
    color: ${extendedColors.text.primary};
  `;

  const NavItem = styled.div`
    padding: 0.75rem 1.5rem;
    margin: 0.25rem 1rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    color: ${extendedColors.text.secondary};
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    overflow: hidden;
    
    &:hover {
      background: ${extendedColors.ui.primary}20;
      color: ${extendedColors.ui.primary};
    }
    
    &.active {
      background: ${extendedColors.ui.primary}10;
      color: ${extendedColors.ui.primary};
      font-weight: 500;
    }
    
    svg {
      margin-right: ${props => props.$isOpen ? '12px' : '0'};
      min-width: 24px;
      font-size: 1.25rem;
    }
  `;

  const ToggleButton = styled.button`
    background: none;
    border: none;
    color: ${extendedColors.text.secondary};
    cursor: pointer;
    padding: 0.5rem;
    margin: 1rem auto;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    transition: all 0.2s ease;
    
    &:hover {
      background: ${extendedColors.ui.primary}20;
      color: ${extendedColors.ui.primary};
    }
  `;

  const Sidebar = styled.div`
    width: ${props => props.$isOpen ? '260px' : '80px'};
    height: 100vh;
    position: fixed;
    background: ${extendedColors.background.primary};
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.2);
    transition: width 0.3s ease;
    padding: 1.5rem 0;
    display: flex;
    flex-direction: column;
    border-right: 1px solid ${extendedColors.ui.border};
    z-index: 10;
  `;

  const MainContent = styled.main`
    flex: 1;
    margin-left: ${props => props.$isSidebarOpen ? '260px' : '80px'};
    transition: margin-left 0.3s ease;
    padding: 2rem;
    min-height: 100vh;
    background-color: ${extendedColors.background.primary};
  `;

  const Header = styled.header`
    background: ${extendedColors.background.secondary};
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid ${extendedColors.ui.border};
    margin: -2rem -2rem 2rem -2rem;
  `;

  const Card = styled.div`
    background: ${extendedColors.background.secondary};
    border-radius: 12px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    border: 1px solid ${extendedColors.ui.border};
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
    }
  `;

  const StatCard = ({ icon, title, value, change, description }) => (
    <Card>
      <div className="flex items-start justify-between">
        <div className="p-3 rounded-lg bg-opacity-10" style={{ backgroundColor: `${extendedColors.ui.primary}20` }}>
          {icon}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold" style={{ color: extendedColors.text.primary }}>{value}</p>
          <p className="text-sm" style={{ color: extendedColors.text.secondary }}>{title}</p>
        </div>
      </div>
      <div className={`mt-2 text-sm ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
        {change >= 0 ? '↑' : '↓'} {Math.abs(change)}% from last month
      </div>
      <p className="mt-1 text-xs" style={{ color: extendedColors.text.muted }}>{description}</p>
    </Card>
  );

  return (
    <PageContainer>
      {/* Sidebar */}
      <Sidebar $isOpen={isSidebarOpen}>
        <div className="px-4 mb-8">
          <div className="flex items-center justify-between">
              {isSidebarOpen && <h1 className="text-xl font-bold" style={{ color: extendedColors.ui.primary }}>Admin Panel</h1>}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg transition-colors duration-200"
              style={{
                color: extendedColors.text.secondary,
                ':hover': {
                  color: extendedColors.ui.primary,
                  backgroundColor: `${extendedColors.ui.primary}10`
                }
              }}
            >
              <FiMenu size={20} />
            </button>
          </div>
        </div>
        
        <nav className="flex-1 px-2 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === item.id
                  ? 'bg-blue-50'
                  : 'hover:bg-gray-50'
              }`}
              style={{
                color: activeTab === item.id ? extendedColors.ui.primary : extendedColors.text.secondary,
                backgroundColor: activeTab === item.id ? `${extendedColors.ui.primary}10` : 'transparent'
              }}
            >
              <span className="mr-3">{item.icon}</span>
              {isSidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        
        <div className="px-4 py-3 border-t border-gray-100 mt-auto">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200"
            style={{
              color: 'white',
              backgroundColor: extendedColors.ui.primary,
              ':hover': {
                backgroundColor: extendedColors.ui.primaryHover
              }
            }}
            title="Logout"
          >
            <FiLogOut className="mr-2" />
            {isSidebarOpen && <span>Logout</span>}
          </button>
          {isSidebarOpen && (
            <p className="mt-2 text-xs text-center text-gray-500">
              Logged in as Admin
            </p>
          )}
        </div>
      </Sidebar>

      {/* Main Content */}
      <MainContent $isSidebarOpen={isSidebarOpen}>
        <Header>
          <h2 className="text-lg font-medium text-gray-900">
            {navItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
          </h2>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <button className="p-1 text-gray-500 hover:text-gray-700">
                <FiBell size={20} />
                <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500"></span>
              </button>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">Admin User</p>
                <p className="text-xs text-gray-500">Administrator</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                AU
              </div>
            </div>
          </div>
        </Header>

        {activeTab === 'overview' && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {stats.map((stat) => (
                <StatCard
                  key={stat.id}
                  icon={stat.icon}
                  title={stat.title}
                  value={stat.value}
                  change={stat.change}
                  description={stat.description}
                />
              ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <Card>
                <h3 className="text-lg font-semibold mb-4 text-gray-800">User Activity</h3>
                <div className="h-64">
                  <Line data={chartData.userActivity} options={chartOptions} />
                </div>
              </Card>
              <Card>
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Repository Statistics</h3>
                <div className="h-64">
                  <Pie data={chartData.repoStats} options={chartOptions} />
                </div>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Recent Activity</h3>
                <button className="text-sm text-blue-600 hover:text-blue-800">View All</button>
              </div>
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mr-3">
                      {activity.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {activity.user} <span className="text-gray-500 font-normal">{activity.action}</span>
                      </p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {activeTab === 'users' && (
          <Card>
            <h3 className="text-lg font-semibold mb-4 text-gray-800">User Management</h3>
            <p className="text-gray-600">User management content will be displayed here</p>
          </Card>
        )}

        {activeTab === 'repos' && (
          <Card>
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Repository Management</h3>
            <p className="text-gray-600">Repository management content will be displayed here</p>
          </Card>
        )}

        {activeTab === 'analytics' && (
          <Card>
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Analytics Dashboard</h3>
            <div className="h-96">
              <Line data={chartData.performanceMetrics} options={chartOptions} />
            </div>
          </Card>
        )}

        {activeTab === 'settings' && (
          <Card>
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Settings</h3>
            <p className="text-gray-600">Settings content will be displayed here</p>
          </Card>
        )}
      </MainContent>
    </PageContainer>
  );
};

export default AdminDashboard;
