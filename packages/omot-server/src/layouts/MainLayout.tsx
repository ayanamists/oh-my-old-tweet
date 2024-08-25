import * as React from 'react';
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import GitHubIcon from '@mui/icons-material/GitHub';
import { CssBaseline } from '@mui/material';
import { Experimental_CssVarsProvider as CssVarsProvider, useColorScheme } from '@mui/material/styles';
import { experimental_extendTheme as extendTheme } from '@mui/material/styles';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { Link } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import Divider from '@mui/material/Divider';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import InboxIcon from '@mui/icons-material/MoveToInbox';
import MailIcon from '@mui/icons-material/Mail';
import SearchIcon from '@mui/icons-material/Search';
import Drawer from '@mui/material/Drawer';
import Switch from  '@mui/material/Switch';
import { TweetContext, TweetDispatchContext } from '@/contexts/TweetContext';

type MainLayoutProps = {
  children: React.ReactNode,
};

const drawerWidth = 240;

// eslint-disable-next-line no-unused-vars
const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })<{
  open?: boolean;
}>(({ theme, open }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginLeft: `-${drawerWidth}px`,
  ...(open && {
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginLeft: 0,
  }),
}));

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})<AppBarProps>(({ theme, open }) => ({
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    width: `calc(100% - ${drawerWidth}px)`,
    marginLeft: `${drawerWidth}px`,
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));



function ToggleColorModeButton() {
  const { mode, setMode } = useColorScheme();
  return (<IconButton onClick={() => {
    setMode(mode === 'light' ? 'dark' : 'light');
  }} color="inherit">
    {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
  </IconButton>);
}

// eslint-disable-next-line no-unused-vars
function ButtonAppBar() {
  const [open, setOpen] = React.useState(false);
  const theme = useTheme();
  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };
  const drawerItems =[
    {
      text: 'Loading',
      href: '/user/loading',
      icon: <InboxIcon />
    },
    {
      text: 'User',
      href: '/user',
      icon: <MailIcon />
    },
    {
      text: 'Bull Dashboard',
      href: '/api/bull',
      icon: <MailIcon />
    },
    {
      text: 'Search',
      href: "/search",
      icon: <SearchIcon />
    }
  ]
  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar component="nav"
        color='transparent'
        sx={{ backdropFilter: "blur(40px)" }}>
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
            onClick={handleDrawerOpen}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            <Link href="/" color='inherit' underline='none'>OMOT</Link>
          </Typography>
          <IconButton
            size='large'
            color='inherit'
            aria-label='github'
            href='https://github.com/ayanamists/oh-my-old-tweet'
            target='_blank'>
            <GitHubIcon />
          </IconButton>
          <ToggleColorModeButton />
        </Toolbar>
      </AppBar>

      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
        variant="persistent"
        anchor="left"
        open={open}
      >
        <DrawerHeader>
          <IconButton onClick={handleDrawerClose}>
            {theme.direction === 'ltr' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </IconButton>
        </DrawerHeader>
        <Divider />
        <List>
          {drawerItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton>
                <ListItemIcon>
                  {item.icon}
                </ListItemIcon>
                <Link href={item.href} underline='none' color='inherit'>
                  <ListItemText primary={item.text} />
                </Link>
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      <Divider />
      <SettingsList />
      </Drawer>
    </Box>
  );
}

function SettingsList() {
  const settings = React.useContext(TweetContext);
  const dispatch = React.useContext(TweetDispatchContext);
  return (<>
    <ListItem>
      <ListItemText id="switch-list-label-coding" primary="Show Reply" />
      <Switch
        edge="end"
        inputProps={{
          'aria-labelledby': 'switch-list-label-coding',
        }}
        onChange={() => {
          dispatch && dispatch({ type: 'showReply', payload: !settings?.showReply })
        }}
        checked={settings?.showReply}
      />
    </ListItem>

    <ListItem>
      <ListItemText id="switch-list-label-coding" primary="Show Image Only" />
      <Switch
        edge="end"
        inputProps={{
          'aria-labelledby': 'switch-list-label-coding',
        }}
        onChange={() => {
          dispatch && dispatch({ type: 'onlyShowImage', payload: !settings?.onlyShowImage })
        }}
        checked={settings?.onlyShowImage}
      />
    </ListItem>
  </>);
}

interface TweetSettings {
  showReply: boolean;
  onlyShowImage: boolean;
}

interface TweetSettingAction {
  type: 'showReply' | 'onlyShowImage',
  payload: boolean
}

function dispatchTweetSettings(state: TweetSettings, action: TweetSettingAction): TweetSettings {
  const t = action.type;
  const v = action.payload;
  return { ...state, [t] : v }
}

function MainLayout({ children }: MainLayoutProps) {
  const theme = React.useMemo(() => extendTheme({
    colorSchemes: {
      light: {
        palette: {
          primary: {
            main: '#1DA1F2'
          }
        }
      },
    },
  }), []);

  const [tweetSettings, dispatch] = React.useReducer(dispatchTweetSettings, { showReply: false, onlyShowImage: false});
  return (
    <TweetContext.Provider value={tweetSettings}>
    <TweetDispatchContext.Provider value={dispatch}>
    <CssVarsProvider theme={theme}>
      <CssBaseline />
      <ButtonAppBar />
      <Box component="main" color={'inherit'}>
        <Toolbar />
        <Box minHeight={'80vh'}
          justifyItems={'center'}
          justifyContent={'center'}
          alignItems={'center'}
          sx={{ display: 'grid' }}>
          {children}
        </Box>
      </Box>
    </CssVarsProvider>
    </TweetDispatchContext.Provider>
    </TweetContext.Provider>
  );
}

export default MainLayout;
