import { Box, Paper, Skeleton } from "@mui/material";

export function SkeletonCard() {
  return (
    <Paper sx={{ p: 2, my: 2 }} data-testid="skeleton-card">
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Skeleton variant="circular" width={40} height={40} sx={{ mr: 1 }} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="40%" />
          <Skeleton variant="text" width="25%" />
        </Box>
      </Box>
      <Skeleton variant="text" />
      <Skeleton variant="text" />
      <Skeleton variant="text" width="80%" />
    </Paper>
  );
}

export function SkeletonList({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </>
  );
}
