import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import CheckIcon from '@mui/icons-material/Check';
import { CssBaseline, Drawer, FormControl, InputLabel, List, ListItem, ListItemText, MenuItem, Select, Switch, TextField, createTheme, useMediaQuery } from '@mui/material';
import { ThemeProvider } from '@emotion/react';
import { ConfigContext } from '../context/ConfigContext';
import { CorsProxyConfig, defaultConfig, getDefaultConfig, saveToLocal } from '../corsUrl';

type MainLayoutProps = {
  children: React.ReactNode,
};

function SideBar() {
  const initConfig = React.useContext(ConfigContext);
  const [mode, setMode] = React.useState(initConfig.mode);
  const [prefix, setPrefix] = React.useState(initConfig.prefix);
  const [coding, setCoding] = React.useState(initConfig.urlEncoding);
  const setConfig = (config: CorsProxyConfig) => {
    initConfig.mode = config.mode;
    initConfig.prefix = config.prefix;
    initConfig.urlEncoding = config.urlEncoding;
    saveToLocal(initConfig);
  };
  return (
    <List>
      <ListItem>
        <Box>
          Cors Proxy Settings
        </Box>
      </ListItem>
      <ListItem>
        <Box sx={{ minWidth: 120 }}>
          <FormControl fullWidth>
            <InputLabel id="mode-select-label">Mode</InputLabel>
            <Select placeholder="Choose one…"
              labelId="mode-select-label"
              value={mode}
              label="mode"
              onChange={(e) => {
                let v = e.target.value;
                const intValue = Number.parseInt(v.toString());
                setMode(intValue);
                const newConfig = intValue === 1 ? defaultConfig : {
                  ...initConfig,
                  mode: intValue,
                  prefix: intValue === 2 ? "" : initConfig.prefix
                };
                setPrefix(newConfig.prefix);
                setConfig(newConfig);
              }}
            >
              <MenuItem value={1}>Cloudflare</MenuItem>
              <MenuItem value={2}>None</MenuItem>
              <MenuItem value={3}>Custom</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </ListItem>
      <ListItem>
        <TextField fullWidth label="Proxy URL" id="ProxyUrl" onChange={(e) => {
          setPrefix(e.target.value);
          setConfig({
            ...initConfig,
            mode: 3,
            prefix: e.target.value
          })
        }}
          value={prefix}
        />
        <IconButton edge="end" aria-label="comments" onClick={() => {
          setConfig({
            ...initConfig,
            prefix: prefix,
          })
        }}>
          <CheckIcon />
        </IconButton>
      </ListItem>

      <ListItem>
        <ListItemText id="switch-list-label-coding" primary="Encoding URLs" />
        <Switch
          edge="end"
          inputProps={{
            'aria-labelledby': 'switch-list-label-coding',
          }}
          onChange={() => {
            const codingNew = ! coding
            setCoding(codingNew);
            setConfig({
              ...initConfig,
              urlEncoding: codingNew
            })
          }}
          checked={coding}
        />
      </ListItem>
    </List>
  );
}

function ButtonAppBar() {
  const [isOpen, setIsOpen] = React.useState(false);
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
            onClick={(_) => {
              setIsOpen(true)
            }}
          >
            <MenuIcon />
          </IconButton>
          <Drawer
            anchor='left'
            open={isOpen}
            onClose={() => {
              setIsOpen(false)
            }}
          >
            <SideBar />
          </Drawer>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            OMOT
          </Typography>
        </Toolbar>
      </AppBar>
    </Box>
  );
}

function MainLayout({ children }: MainLayoutProps) {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode: prefersDarkMode ? 'dark' : 'light',
        },
      }),
    [prefersDarkMode]);

  return (
    <ConfigContext.Provider value={getDefaultConfig()}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ButtonAppBar />
        <Box component="main" color={'inherit'}>
          <Toolbar />
          <Box minHeight={'90vh'}
            justifyItems={'center'}
            justifyContent={'center'}
            alignItems={'center'}
            sx={{ display: 'grid' }}>
            {children}
          </Box>
        </Box>
      </ThemeProvider>
    </ConfigContext.Provider>)
}

export default MainLayout;