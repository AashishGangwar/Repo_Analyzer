import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';
import { Bar, Pie } from 'react-chartjs-2';
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
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const AnalyzePage = () => {
  const { owner, repo } = useParams();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [metadata, setMetadata] = useState(null);
  const [contributors, setContributors] = useState([]);
  const [commitData, setCommitData] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!owner || !repo) {
      navigate('/');
      return;
    }

    const fetchRepoData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [repoRes, contribRes, commitRes] = await Promise.all([
          axios.get(`https://api.github.com/repos/${owner}/${repo}`),
          axios.get(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=10`),
          axios.get(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=30`)
        ]);

        setMetadata(repoRes.data);
        setContributors(contribRes.data);
        setCommitData(commitRes.data);
      } catch (error) {
        setError('❌ Unable to fetch data. Please check if the repo is public and exists.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRepoData();
  }, [owner, repo, navigate]);

  const renderBarChart = () => (
    <Bar
      data={{
        labels: contributors.map((c) => c.login),
        datasets: [{
          label: 'Contributions',
          data: contributors.map((c) => c.contributions),
          backgroundColor: '#6366f1'
        }]
      }}
      options={{
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { mode: 'index', intersect: false }
        }
      }}
    />
  );

  const renderPieChart = () => {
    const authorCommits = commitData.reduce((acc, commit) => {
      const name = commit.commit?.author?.name;
      if (name) acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});

    return (
      <Pie
        data={{
          labels: Object.keys(authorCommits),
          datasets: [{
            data: Object.values(authorCommits),
            backgroundColor: [
              '#4f46e5', '#e53e3e', '#38a169', '#d69e2e', '#3182ce',
              '#805ad5', '#dd6b20', '#f56565', '#48bb78', '#ed8936',
            ]
          }]
        }}
        options={{
          responsive: true,
          plugins: {
            legend: { position: 'right' },
            tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw} commits` } }
          }
        }}
      />
    );
  };

  return (
    <PageContainer>
      <NavBar />
      <Content>
        {isLoading ? (
          <Loading>Analyzing <strong>{owner}/{repo}</strong>... 🔍</Loading>
        ) : error ? (
          <Error>
            {error}
            <RetryButton onClick={() => navigate('/')}>Go Back</RetryButton>
          </Error>
        ) : (
          <Card>
            <Title>📊 Repository Analysis</Title>

            <Section>
              <h2>{metadata.full_name}</h2>
              {metadata.description && <p>{metadata.description}</p>}
              <MetaRow>
                <Meta>⭐ {metadata.stargazers_count}</Meta>
                <Meta>🍴 {metadata.forks_count}</Meta>
                <Meta>🐛 {metadata.open_issues_count}</Meta>
                <Meta>📝 {metadata.language || 'Unknown'}</Meta>
                <RepoLink href={metadata.html_url} target="_blank">View on GitHub</RepoLink>
              </MetaRow>
            </Section>

            {contributors.length > 0 && (
              <Section>
                <h3>👥 Top Contributors</h3>
                <ChartContainer>{renderBarChart()}</ChartContainer>
              </Section>
            )}

            {commitData.length > 0 && (
              <Section>
                <h3>🔁 Recent Commit Activity</h3>
                <ChartContainer>{renderPieChart()}</ChartContainer>
              </Section>
            )}
          </Card>
        )}
      </Content>
    </PageContainer>
  );
};

export default AnalyzePage;


const PageContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${colors.background.primary};
`;

const Content = styled.div`
  flex: 1;
  padding: 2rem;
  max-width: 1100px;
  margin: 0 auto;
`;

const Card = styled.div`
  background: ${colors.background.secondary};
  padding: 2rem;
  border-radius: 1rem;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
`;

const Title = styled.h1`
  font-size: 2rem;
  margin-bottom: 2rem;
  color: ${colors.text.primary};
`;

const Section = styled.div`
  margin: 2rem 0;

  h2, h3 {
    color: ${colors.text.primary};
    margin-bottom: 0.75rem;
  }

  p {
    color: ${colors.text.secondary};
    margin-bottom: 1rem;
  }
`;

const MetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
`;

const Meta = styled.span`
  font-size: 0.9rem;
  color: ${colors.text.secondary};
`;

const RepoLink = styled.a`
  color: ${colors.ui.primary};
  font-weight: bold;
  text-decoration: none;
  margin-left: auto;

  &:hover {
    text-decoration: underline;
  }
`;

const ChartContainer = styled.div`
  background: ${colors.background.primary};
  padding: 1.5rem;
  border-radius: 0.75rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  min-height: 300px;
`;

const Loading = styled.div`
  text-align: center;
  font-size: 1.25rem;
  color: ${colors.text.secondary};
  padding-top: 4rem;
`;

const Error = styled.div`
  text-align: center;
  padding: 2rem;
  color: ${colors.state.error};
  background-color: ${colors.state.errorBg};
  border-radius: 0.5rem;
`;

const RetryButton = styled.button`
  margin-top: 1rem;
  padding: 0.5rem 1.25rem;
  background: ${colors.ui.primary};
  border: none;
  border-radius: 0.5rem;
  color: white;
  cursor: pointer;
  font-weight: 600;

  &:hover {
    background: ${colors.ui.primaryDark};
  }
`;
