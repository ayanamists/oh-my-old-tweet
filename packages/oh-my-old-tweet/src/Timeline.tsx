import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { CdxItem, User } from "twitter-data-parser";
import { getCdxList } from "./Data";
import { LoadableTCard } from "./LoadableTCard";
import { ConfigContext } from "./context/ConfigContext";
import { ErrorBoundary, useErrorBoundary, } from "react-error-boundary";
import { Box, CircularProgress, List, ListItem, Typography, Paper, Avatar, IconButton, Grid, Divider, Link as MuiLink } from "@mui/material";
import InfiniteScroll from "react-infinite-scroll-component";
import { FilterContext } from "./context/FilterContext";
import { DateTime } from "luxon";
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LinkIcon from '@mui/icons-material/Link';

function LoadingCircle() {
  return (<CircularProgress size={60} />);
}

function fallbackRender({ error }: { error: Error }) {
  return (<Box>
    <Typography variant="h1">Error</Typography>
    <Typography>{error.message}</Typography>
    <Typography variant="h3" sx={{ mt: 3 }}>Solution</Typography>
    <List>
      <ListItem>
        <Typography>1. Change CORS Proxy Settings</Typography>
      </ListItem>
      <ListItem>
        <Typography>2. Contact Authors</Typography>
      </ListItem>
    </List>
  </Box>
  );
}

interface UserProfileProps {
  profile: User | null;
  profileDate: string;
  onPrevProfile: () => void;
  onNextProfile: () => void;
  hasNext: boolean;
  hasPrev: boolean;
}

function UserProfile({ profile, profileDate, onPrevProfile, onNextProfile, hasNext, hasPrev }: UserProfileProps) {
  if (!profile) {
    return (
      <Paper sx={{ p: 2, height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body1">No profile information available</Typography>
      </Paper>
    );
  }

  const profileInfo = profile.profileInfo;
  const avatarUrl = profileInfo?.bigAvatar || profile?.avatar;

  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>

        <Avatar
          id={`avatar-${profile.userName}`}
          src={avatarUrl}
          alt={profile.fullName}
          sx={{ 
            width: 120, 
            height: 120, 
            mb: 2,
          }}
        />
        
        <Typography variant="h6" fontWeight="bold">{profile.fullName}</Typography>
        <Typography variant="body2" color="text.secondary">@{profile.userName}</Typography>
      </Box>

      {profileInfo && (
        <Box sx={{ mb: 2, flex: 1 }}>
          {profileInfo.text && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              {profileInfo.text}
            </Typography>
          )}

          {(profileInfo.location || profileInfo.urls?.length) && (
            <Box sx={{ mb: 2 }}>
              {profileInfo.location && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <LocationOnIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography variant="body2">{profileInfo.location}</Typography>
                </Box>
              )}
              
              {profileInfo.urls && profileInfo.urls.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <LinkIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography variant="body2" component="a" href={profileInfo.urls[0]} target="_blank" sx={{ textDecoration: 'none', color: 'primary.main' }}>
                    {profileInfo.urls[0].replace(/^https?:\/\/(www\.)?/, '')}
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            {profileInfo.followers !== undefined && (
              <Typography variant="body2">
                <strong>{profileInfo.followers.toLocaleString()}</strong> Followers
              </Typography>
            )}
            {profileInfo.following !== undefined && (
              <Typography variant="body2">
                <strong>{profileInfo.following.toLocaleString()}</strong> Following
              </Typography>
            )}
          </Box>

          {profileInfo.joined && (
            <Typography variant="body2" color="text.secondary">
              Joined {profileInfo.joined}
            </Typography>
          )}
        </Box>
      )}

      <Divider sx={{ my: 1 }} />
      
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton onClick={onPrevProfile} disabled={!hasPrev}>
          <ArrowBackIosNewIcon fontSize="small" />
        </IconButton>
        
        <Typography variant="caption" color="text.secondary">
          Profile as of {profileDate}
        </Typography>
        
        <IconButton onClick={onNextProfile} disabled={!hasNext}>
          <ArrowForwardIosIcon fontSize="small" />
        </IconButton>
      </Box>
    </Paper>
  );
}

function Timeline1({ user }: { user: string }) {
  const [lst, setLst] = useState<JSX.Element[]>([]);
  const cdxList = useRef<CdxItem[] | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const { config } = useContext(ConfigContext);
  const [isInitLoading, setIsInitLoading] = useState(true);
  const { showBoundary } = useErrorBoundary();
  const page = useRef(0);
  const pageSize = 30;
  
  // User profile state
  const [profiles, setProfiles] = useState<User[]>([]);
  const [currentProfileIndex, setCurrentProfileIndex] = useState(0);
  const [profileDate, setProfileDate] = useState<string>("");
  
  const updateLst = useCallback((cdxData, init: boolean) => {
    const l = cdxData.map((i: CdxItem) =>
      <LoadableTCard 
        user={user} 
        cdxItem={{ ... i, origUrl: i.original }} 
        key={i.id} 
        onProfileLoaded={(post) => {
          if (post.user && post.user.profileInfo) {
            setProfiles(prevProfiles => {
              // Check if we already have this profile (by username and profile text)
              const exists = prevProfiles.some(p =>
                p.userName === post.user.userName &&
                p.profileInfo?.text === post.user.profileInfo?.text
              );

              if (!exists) {
                return [...prevProfiles, post.user];
              }
              return prevProfiles;
            });
          }
        }}
      />);
    setLst(lst => init ? l : lst.concat(l));
  }, []);
  
  const fetchData = (init: boolean) => {
    if (init) {
      page.current = 0;
    }
    if (cdxList.current == null) return; // that should not happen
    const pageNow = page.current;
    if (pageNow * pageSize >= cdxList.current.length) {
      setHasMore(false);
    } else {
      const nextData = cdxList.current.slice(pageNow * pageSize, (pageNow + 1) * pageSize);
      page.current += 1;
      updateLst(nextData, init);
    }
  }
  
  const { tweetFilter } = useContext(FilterContext);
  const { dateInRange } = tweetFilter;
  
  useEffect(() => {
    getCdxList(config!, user, dateInRange).then((data) => {
      cdxList.current = data.filter(i => dateInRange.contains(DateTime.fromJSDate(i.date)));
      fetchData(true);
      setIsInitLoading(false);
    }).catch((e) => {
      showBoundary(e);
    });
  }, [config, user, showBoundary, dateInRange]);

  useEffect(() => {
    if (profiles.length > 0) {
      const formattedDate = DateTime.fromJSDate(new Date()).toFormat('MMM d, yyyy');
      setProfileDate(formattedDate);
    }
  }, [profiles, currentProfileIndex]);

  const handlePrevProfile = () => {
    if (currentProfileIndex > 0) {
      setCurrentProfileIndex(currentProfileIndex - 1);
    }
  };

  const handleNextProfile = () => {
    if (currentProfileIndex < profiles.length - 1) {
      setCurrentProfileIndex(currentProfileIndex + 1);
    }
  };

  // TODO: fix empty logic
  return ((isInitLoading) ? <LoadingCircle /> :
    <Grid container spacing={3} sx={{ width: '100%', maxWidth: '1000px', mx: 'auto', px: 2 }}>
      <Grid item xs={12} md={3} lg={4} sx={{
        display: { xs: 'none', md: 'block' },
        height: "80vh",
        top: 100,
        position: 'sticky'
      }}>
        <UserProfile
          profile={profiles.length > 0 ? profiles[currentProfileIndex] : null}
          profileDate={profileDate}
          onPrevProfile={handlePrevProfile}
          onNextProfile={handleNextProfile}
          hasPrev={currentProfileIndex > 0}
          hasNext={currentProfileIndex < profiles.length - 1}
        />
      </Grid>
      <Grid item xs={12} md={8} lg={8}>
        <InfiniteScroll
          dataLength={lst.length}
          next={() => fetchData(false)}
          hasMore={hasMore}
          loader={null}
          endMessage={null}
        >
          {lst}
        </InfiniteScroll>
      </Grid>
    </Grid>
  );
}

export function Timeline({ user }: { user: string }) {
  return (<ErrorBoundary fallbackRender={fallbackRender}>
    <Timeline1 user={user} />
  </ErrorBoundary>)
}
