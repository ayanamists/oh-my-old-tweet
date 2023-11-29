import * as React from 'react';
import AppBar from '@mui/material/AppBar';
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

type MainLayoutProps = {
  children: React.ReactNode,
};


function ToggleColorModeButton() {
  const { mode, setMode } = useColorScheme();
  return (<IconButton onClick={() => {
    setMode(mode === 'light' ? 'dark' : 'light');
  }} color="inherit">
    {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
  </IconButton>);
}

function ButtonAppBar() {
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
            onClick={() => {
            }}
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
    </Box>
  );
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


  return (
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
  );
}

export default MainLayout;