import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import { Grid, Box } from '@/components/ui';
import {
  People as PeopleIcon,
  Event as EventIcon,
  Timer as TimerIcon,
  DeviceHub as DeviceHubIcon,
} from '@mui/icons-material';
import { AnalyticsSummary } from '../types';

interface Props {
  summary: AnalyticsSummary;
}

const AnalyticsSummaryCards: React.FC<Props> = ({ summary }) => {
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}초`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}분`;
    return `${Math.round(seconds / 3600)}시간`;
  };

  const cards = [
    {
      title: '총 이벤트',
      value: summary.totalEvents.toLocaleString(),
      icon: <EventIcon sx={{ fontSize: 40 }} />,
      color: '#1976d2',
    },
    {
      title: '고유 사용자',
      value: summary.uniqueUsers.toLocaleString(),
      icon: <PeopleIcon sx={{ fontSize: 40 }} />,
      color: '#388e3c',
    },
    {
      title: '총 세션',
      value: summary.totalSessions.toLocaleString(),
      icon: <DeviceHubIcon sx={{ fontSize: 40 }} />,
      color: '#f57c00',
    },
    {
      title: '평균 세션 시간',
      value: formatDuration(summary.avgSessionDuration),
      icon: <TimerIcon sx={{ fontSize: 40 }} />,
      color: '#7b1fa2',
    },
  ];

  return (
    <Grid container spacing={3}>
      {cards.map((card, index) => (
        <Grid item xs={12} sm={6} md={3} key={index}>
          <Card
            sx={{
              height: '100%',
              background: `linear-gradient(135deg, ${card.color}15 0%, ${card.color}05 100%)`,
              borderTop: `3px solid ${card.color}`,
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Box color={card.color} mr={2}>{card.icon}</Box>
                <Typography variant="h6" component="div">
                  {card.title}
                </Typography>
              </Box>
              <Typography variant="h3" component="div" sx={{ fontWeight: 'bold' }}>
                {card.value}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default AnalyticsSummaryCards;
