import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';
import { Bar, Pie, Line } from 'react-chartjs-2';
import { 
  FiGitBranch, 
  FiStar, 
  FiEye, 
  FiGitPullRequest, 
  FiAlertCircle, 
  FiCode, 
  FiClock,
  FiUsers,
  FiGitCommit,
  FiArrowLeft,
  FiGithub
} from 'react-icons/fi';
import NavBar from '../Components/NavBar';
import { colors } from '../theme/colors';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  ArcElement,
  BarElement,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  Title as ChartTitle
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  ArcElement,
  BarElement,
  PointElement,
  LineElement,
  ChartTitle,
  Tooltip,
  Legend
);

// Chart configuration
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: colors.text.secondary,
        font: {
          size: 12,
        },
        padding: 20
      }
    },
    tooltip: {
      backgroundColor: colors.background.secondary,
      titleColor: colors.text.primary,
      bodyColor: colors.text.secondary,
      borderColor: colors.ui.border,
      borderWidth: 1,
      padding: 12,
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      callbacks: {
        label: function(context) {
          return context.raw || '';
        }
      }
    }
  },
  scales: {
    x: {
      grid: {
        color: 'rgba(255, 255, 255, 0.1)'
      },
      ticks: {
        color: colors.text.secondary
      }
    },
    y: {
      grid: {
        color: 'rgba(255, 255, 255, 0.1)'
      },
      ticks: {
        color: colors.text.secondary
      }
    }
  }
};

const AnalyzeEnhanced = () => {
  const { owner, repo } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [metadata, setMetadata] = useState(null);
  const [contributors, setContributors] = useState([]);
  const [commitData, setCommitData] = useState([]);
  const [languages, setLanguages] = useState({});
  const [pulls, setPulls] = useState({ open: 0, closed: 0 });
  const [error, setError] = useState(null);

  // Format numbers with commas
  const formatNumber = (num) => {
    return num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") || '0';
  };

  // Calculate time since last update
  const timeSince = (date) => {
    if (!date) return 'N/A';
    const now = new Date();
    const updated = new Date(date);
    const diffInDays = Math.floor((now - updated) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'today';
    if (diffInDays === 1) return 'yesterday';
    if (diffInDays < 30) return `${diffInDays} days ago`;
    
    const months = Math.floor(diffInDays / 30);
    if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
    
    const years = Math.floor(months / 12);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  };

  // Fetch repository data
  useEffect(() => {
    if (!owner || !repo) {
      navigate('/');
      return;
    }

    const fetchRepoData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const [
          repoRes, 
          contribRes, 
          commitRes, 
          langsRes,
          pullsRes
        ] = await Promise.all([
          axios.get(`https://api.github.com/repos/${owner}/${repo}`),
          axios.get(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=10`),
          axios.get(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=30`),
          axios.get(`https://api.github.com/repos/${owner}/${repo}/languages`),
          axios.get(`https://api.github.com/search/issues?q=repo:${owner}/${repo}+is:pr+is:open&per_page=1`)
        ]);

        // Process pull requests
        const openPulls = pullsRes?.data?.total_count || 0;
        
        // Get closed PRs count
        try {
          const closedRes = await axios.get(
            `https://api.github.com/search/issues?q=repo:${owner}/${repo}+is:pr+is:closed&per_page=1`
          );
          const closedPulls = closedRes?.data?.total_count || 0;
          
          setPulls({
            open: openPulls,
            closed: closedPulls,
            total: openPulls + closedPulls
          });
        } catch (e) {
          console.error('Error fetching closed PRs:', e);
          setPulls({ open: openPulls, closed: 0, total: openPulls });
        }

        setMetadata(repoRes.data);
        setContributors(contribRes.data || []);
        setCommitData(commitRes.data || []);
        setLanguages(langsRes.data || {});
      } catch (error) {
        console.error('Error fetching repository data:', error);
        setError(error.response?.data?.message || 'Failed to fetch repository data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRepoData();
  }, [owner, repo, navigate]);

  // Process data for charts
  const { languageData, commitActivity, contributorActivity } = useMemo(() => {
    // Process language data
    const totalBytes = Object.values(languages).reduce((sum, val) => sum + val, 0);
    const languageData = Object.entries(languages).map(([name, bytes]) => ({
      name,
      bytes,
      percentage: Math.round((bytes / totalBytes) * 100) || 0
    })).sort((a, b) => b.bytes - a.bytes);

    // Process commit activity (last 10 commits)
    const commitActivity = commitData.slice(0, 10).map(commit => ({
      date: new Date(commit.commit.author.date).toLocaleDateString(),
      message: commit.commit.message.split('\n')[0],
      author: commit.commit.author.name,
      sha: commit.sha.slice(0, 7)
    }));

    // Process contributor activity
    const contributorActivity = contributors.map(contributor => ({
      login: contributor.login,
      contributions: contributor.contributions,
      avatar: contributor.avatar_url,
      url: contributor.html_url
    })).sort((a, b) => b.contributions - a.contributions);

    return { languageData, commitActivity, contributorActivity };
  }, [languages, commitData, contributors]);

  // Chart data
  const languageChartData = {
    labels: languageData.map(lang => lang.name),
    datasets: [{
      data: languageData.map(lang => lang.percentage),
      backgroundColor: [
        '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#8B5CF6'
      ],
      borderWidth: 0
    }]
  };

  const contributorChartData = {
    labels: contributorActivity.slice(0, 10).map(c => c.login),
    datasets: [{
      label: 'Contributions',
      data: contributorActivity.slice(0, 10).map(c => c.contributions),
      backgroundColor: 'rgba(79, 70, 229, 0.7)',
      borderColor: 'rgba(79, 70, 229, 1)',
      borderWidth: 1,
      borderRadius: 4
    }]
  };

  const pullRequestData = {
    labels: ['Open', 'Merged/Closed'],
    datasets: [{
      data: [pulls.open, pulls.closed],
      backgroundColor: ['#10B981', '#EF4444'],
      borderWidth: 0
    }]
  };

  if (isLoading) {
    return (
      <PageContainer>
        <NavBar />
        <Content>
          <Loader>
            <div className="spinner"></div>
            <h2>Analyzing {owner}/{repo}</h2>
            <p>Fetching repository data from GitHub...</p>
          </Loader>
        </Content>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <NavBar />
        <Content>
          <ErrorContainer>
            <ErrorIcon />
            <h2>Error Loading Repository</h2>
            <p>{error.message || 'Failed to load repository data'}</p>
            <ButtonContainer>
              <BackButton onClick={() => navigate(-1)}>
                <FiArrowLeft /> Go Back
              </BackButton>
              <HomeButton onClick={() => navigate('/')}>
                Back to Home
              </HomeButton>
            </ButtonContainer>
          </ErrorContainer>
        </Content>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <NavBar />
      <Content>
        <Header>
          <BackLink onClick={() => navigate(-1)}>
            <FiArrowLeft /> Back
          </BackLink>
          <TitleWrapper>
            <h1>{metadata.full_name}</h1>
            <p>{metadata.description}</p>
            <RepoMeta>
              <MetaItem>
                <FiStar /> {formatNumber(metadata.stargazers_count)}
              </MetaItem>
              <MetaItem>
                <FiGitBranch /> {formatNumber(metadata.forks_count)}
              </MetaItem>
              <MetaItem>
                <FiAlertCircle /> {formatNumber(metadata.open_issues_count)} issues
              </MetaItem>
              <MetaItem>
                <FiEye /> {formatNumber(metadata.watchers_count)} watching
              </MetaItem>
              <MetaItem>
                <FiCode /> {languageData[0]?.name || 'N/A'} {languageData[0]?.percentage ? `(${languageData[0].percentage}%)` : ''}
              </MetaItem>
              <MetaItem>
                <FiClock /> Updated {timeSince(metadata.updated_at)}
              </MetaItem>
            </RepoMeta>
            <ViewOnGitHub href={metadata.html_url} target="_blank" rel="noopener noreferrer">
              <FiGithub /> View on GitHub
            </ViewOnGitHub>
          </TitleWrapper>
        </Header>

        <Dashboard>
          {/* Stats Cards */}
          <StatsGrid>
            <StatCard>
              <StatIcon><FiGitBranch /></StatIcon>
              <StatValue>{formatNumber(metadata.forks_count)}</StatValue>
              <StatLabel>Forks</StatLabel>
            </StatCard>
            <StatCard>
              <StatIcon><FiStar /></StatIcon>
              <StatValue>{formatNumber(metadata.stargazers_count)}</StatValue>
              <StatLabel>Stars</StatLabel>
            </StatCard>
            <StatCard>
              <StatIcon><FiGitPullRequest /></StatIcon>
              <StatValue>{formatNumber(pulls.total)}</StatValue>
              <StatLabel>Pull Requests</StatLabel>
            </StatCard>
            <StatCard>
              <StatIcon><FiUsers /></StatIcon>
              <StatValue>{contributors.length}+</StatValue>
              <StatLabel>Contributors</StatLabel>
            </StatCard>
          </StatsGrid>

          {/* Main Content */}
          <MainContent>
            {/* Left Column */}
            <LeftColumn>
              {/* Languages */}
              <ChartCard>
                <CardHeader>
                  <h3>Languages</h3>
                  <small>Code distribution by language</small>
                </CardHeader>
                <ChartContainer>
                  {languageData.length > 0 ? (
                    <Pie 
                      data={languageChartData} 
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          legend: {
                            ...chartOptions.plugins.legend,
                            position: 'right'
                          }
                        }
                      }} 
                    />
                  ) : (
                    <NoData>No language data available</NoData>
                  )}
                </ChartContainer>
              </ChartCard>

              {/* Recent Commits */}
              <ChartCard>
                <CardHeader>
                  <h3>Recent Commits</h3>
                  <small>Latest updates to the repository</small>
                </CardHeader>
                <CommitList>
                  {commitActivity.length > 0 ? (
                    commitActivity.map((commit, index) => (
                      <CommitItem key={index}>
                        <CommitMessage>{commit.message}</CommitMessage>
                        <CommitMeta>
                          <span>{commit.author}</span>
                          <span>{commit.date}</span>
                        </CommitMeta>
                      </CommitItem>
                    ))
                  ) : (
                    <NoData>No recent commits found</NoData>
                  )}
                </CommitList>
              </ChartCard>
            </LeftColumn>

            {/* Right Column */}
            <RightColumn>
              {/* Top Contributors */}
              <ChartCard>
                <CardHeader>
                  <h3>Top Contributors</h3>
                  <small>Most active contributors</small>
                </CardHeader>
                <ChartContainer>
                  {contributorActivity.length > 0 ? (
                    <Bar 
                      data={contributorChartData} 
                      options={{
                        ...chartOptions,
                        indexAxis: 'y',
                        plugins: {
                          ...chartOptions.plugins,
                          legend: {
                            display: false
                          }
                        }
                      }} 
                    />
                  ) : (
                    <NoData>No contributor data available</NoData>
                  )}
                </ChartContainer>
                <ContributorList>
                  {contributorActivity.slice(0, 5).map((contributor, index) => (
                    <ContributorItem key={index}>
                      <ContributorAvatar 
                        src={contributor.avatar} 
                        alt={contributor.login} 
                      />
                      <ContributorInfo>
                        <a 
                          href={contributor.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          {contributor.login}
                        </a>
                        <span>{formatNumber(contributor.contributions)} commits</span>
                      </ContributorInfo>
                    </ContributorItem>
                  ))}
                </ContributorList>
              </ChartCard>

              {/* Pull Requests */}
              <ChartCard>
                <CardHeader>
                  <h3>Pull Requests</h3>
                  <small>Open vs Closed/Merged</small>
                </CardHeader>
                <ChartContainer>
                  {pulls.total > 0 ? (
                    <Pie 
                      data={pullRequestData} 
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          legend: {
                            ...chartOptions.plugins.legend,
                            position: 'bottom'
                          }
                        }
                      }} 
                    />
                  ) : (
                    <NoData>No pull request data available</NoData>
                  )}
                </ChartContainer>
                <PullStats>
                  <PullStatItem>
                    <PullStatBadge color="#10B981" />
                    <span>Open: {pulls.open}</span>
                  </PullStatItem>
                  <PullStatItem>
                    <PullStatBadge color="#EF4444" />
                    <span>Closed/Merged: {pulls.closed}</span>
                  </PullStatItem>
                  <PullStatItem>
                    <PullStatBadge color="#4F46E5" />
                    <span>Total: {pulls.total}</span>
                  </PullStatItem>
                </PullStats>
              </ChartCard>
            </RightColumn>
          </MainContent>
        </Dashboard>
      </Content>
    </PageContainer>
  );
};

// Styled Components
const PageContainer = styled.div`
  min-height: 100vh;
  background-color: ${colors.background.primary};
  color: ${colors.text.primary};
`;

const Content = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
`;

const Loader = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  
  .spinner {
    width: 50px;
    height: 50px;
    border: 4px solid rgba(79, 70, 229, 0.3);
    border-radius: 50%;
    border-top-color: #4F46E5;
    animation: spin 1s ease-in-out infinite;
    margin-bottom: 1.5rem;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  h2 {
    margin-bottom: 0.5rem;
    color: ${colors.text.primary};
  }
  
  p {
    color: ${colors.text.secondary};
    margin: 0;
  }
`;

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  
  h2 {
    color: ${colors.state.error};
    margin: 1.5rem 0 0.5rem;
  }
  
  p {
    color: ${colors.text.secondary};
    margin-bottom: 2rem;
    max-width: 500px;
    line-height: 1.6;
  }
`;

const ErrorIcon = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background-color: rgba(239, 68, 68, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  color: ${colors.state.error};
  
  &::before {
    content: '!';
    font-weight: bold;
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
`;

const BackButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.2rem;
  background-color: ${colors.background.secondary};
  color: ${colors.text.primary};
  border: 1px solid ${colors.ui.border};
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background-color: ${colors.background.tertiary};
  }
  
  svg {
    font-size: 1.1em;
  }
`;

const HomeButton = styled(BackButton)`
  background-color: ${colors.ui.primary};
  border-color: ${colors.ui.primary};
  color: white;
  
  &:hover {
    background-color: ${colors.ui.primaryHover};
    border-color: ${colors.ui.primaryHover};
  }
`;

const Header = styled.header`
  margin-bottom: 2.5rem;
`;

const BackLink = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  color: ${colors.text.secondary};
  font-size: 0.95rem;
  margin-bottom: 1.5rem;
  cursor: pointer;
  padding: 0.5rem 0;
  transition: color 0.2s;
  
  &:hover {
    color: ${colors.ui.primary};
  }
  
  svg {
    font-size: 1.1em;
  }
`;

const TitleWrapper = styled.div`
  h1 {
    font-size: 2.2rem;
    margin: 0 0 0.5rem;
    color: ${colors.text.primary};
    line-height: 1.2;
  }
  
  p {
    color: ${colors.text.secondary};
    font-size: 1.1rem;
    margin: 0 0 1.5rem;
    max-width: 800px;
    line-height: 1.6;
  }
`;

const RepoMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  margin: 1.5rem 0;
`;

const MetaItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  color: ${colors.text.secondary};
  
  svg {
    color: ${colors.text.primary};
    font-size: 1.1em;
  }
`;

const ViewOnGitHub = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background-color: ${colors.background.secondary};
  color: ${colors.text.primary};
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s;
  margin-top: 1rem;
  border: 1px solid ${colors.ui.border};
  
  &:hover {
    background-color: ${colors.background.tertiary};
  }
  
  svg {
    font-size: 1.1em;
  }
`;

const Dashboard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1rem;
`;

const StatCard = styled.div`
  background-color: ${colors.background.secondary};
  border-radius: 10px;
  padding: 1.5rem;
  text-align: center;
  transition: transform 0.2s, box-shadow 0.2s;
  border: 1px solid ${colors.ui.border};
  
  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
  }
`;

const StatIcon = styled.div`
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background-color: rgba(79, 70, 229, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
  font-size: 1.5rem;
  color: ${colors.ui.primary};
`;

const StatValue = styled.div`
  font-size: 1.8rem;
  font-weight: 700;
  color: ${colors.text.primary};
  margin-bottom: 0.25rem;
`;

const StatLabel = styled.div`
  font-size: 0.9rem;
  color: ${colors.text.secondary};
`;

const MainContent = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  
  @media (min-width: 1200px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const LeftColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

const RightColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

const ChartCard = styled.div`
  background-color: ${colors.background.secondary};
  border-radius: 10px;
  padding: 1.5rem;
  border: 1px solid ${colors.ui.border};
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
`;

const CardHeader = styled.div`
  margin-bottom: 1.5rem;
  
  h3 {
    margin: 0 0 0.25rem;
    color: ${colors.text.primary};
    font-size: 1.25rem;
  }
  
  small {
    color: ${colors.text.secondary};
    font-size: 0.9rem;
  }
`;

const ChartContainer = styled.div`
  height: 300px;
  position: relative;
  margin: 0 -0.5rem;
`;

const NoData = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: ${colors.text.secondary};
  font-style: italic;
`;

const CommitList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const CommitItem = styled.div`
  background-color: ${colors.background.tertiary};
  border-radius: 8px;
  padding: 1rem;
  border-left: 3px solid ${colors.ui.primary};
  transition: transform 0.2s;
  
  &:hover {
    transform: translateX(3px);
  }
`;

const CommitMessage = styled.div`
  font-weight: 500;
  color: ${colors.text.primary};
  margin-bottom: 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CommitMeta = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: ${colors.text.secondary};
`;

const ContributorList = styled.div`
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const ContributorItem = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid ${colors.ui.border};
  
  &:last-child {
    border-bottom: none;
  }
`;

const ContributorAvatar = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
`;

const ContributorInfo = styled.div`
  display: flex;
  flex-direction: column;
  
  a {
    color: ${colors.text.primary};
    font-weight: 500;
    text-decoration: none;
    transition: color 0.2s;
    
    &:hover {
      color: ${colors.ui.primary};
      text-decoration: underline;
    }
  }
  
  span {
    font-size: 0.85rem;
    color: ${colors.text.secondary};
  }
`;

const PullStats = styled.div`
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-top: 1.5rem;
  flex-wrap: wrap;
`;

const PullStatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
`;

const PullStatBadge = styled.span`
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: ${props => props.color || '#4F46E5'};
`;

export default AnalyzeEnhanced;
