"use client";

import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import CheckIcon from '@mui/icons-material/Check';
import GitHubIcon from '@mui/icons-material/GitHub';
import HelpIcon from '@mui/icons-material/Help';
import { Button, CssBaseline, Divider, Drawer, FormControl, FormControlLabel, FormGroup, InputLabel, Link, List, ListItem, ListItemText, MenuItem, Select, Switch, TextField, createTheme, useMediaQuery } from '@mui/material';
import { ThemeProvider } from '@emotion/react';
import { ConfigContext } from '../context/ConfigContext';
import { CorsProxyConfig, defaultConfig, saveToLocal } from '../corsUrl';
import { FilterContext, TweetFilter } from 'src/context/FilterContext';
import CheckBox from '@mui/material/Checkbox';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DateTime } from 'luxon';

type MainLayoutProps = {
  children: React.ReactNode,
};

function setIncludeContent(tweetFilter: TweetFilter, content: "reply" | "post", value: boolean) {
  const newContent = [...tweetFilter.contentBelongTo];
  if (value) {
    if (!newContent.includes(content)) {
      newContent.push(content);
    }
  } else {
    const index = newContent.indexOf(content);
    if (index !== -1) {
      newContent.splice(index, 1);
    }
  }
  return newContent;
}

function SideBar() {
  const { config, setConfig } = React.useContext(ConfigContext);
  const initConfig = config!;
  const { tweetFilter, setTweetFilter } = React.useContext(FilterContext);
  const [prefix, setPrefix] = React.useState<string>(initConfig.prefix);
  const _setConfig = (config: CorsProxyConfig) => {
    setConfig(config);
    setPrefix(config.prefix);
    saveToLocal(config);
  };
  const includeReply = tweetFilter.contentBelongTo.includes("reply");
  const includePost = tweetFilter.contentBelongTo.includes("post");
  const toggleIncludeReply = (value) => {
    const newContent = setIncludeContent(tweetFilter, "reply", value);
    setTweetFilter({
      ...tweetFilter,
      contentBelongTo: newContent
    });
  };
  const toggleIncludePost = (value) => {
    const newContent = setIncludeContent(tweetFilter, "post", value);
    setTweetFilter({
      ...tweetFilter,
      contentBelongTo: newContent
    });
  };

  // Handle date range filter
  const startDate = tweetFilter.dateInRange[0] === "any" ? null : tweetFilter.dateInRange[0];
  const endDate = tweetFilter.dateInRange[1] === "any" ? null : tweetFilter.dateInRange[1];

  const handleStartDateChange = (newDate: DateTime | null) => {
    setTweetFilter({
      ...tweetFilter,
      dateInRange: [newDate || "any", tweetFilter.dateInRange[1]]
    });
  };

  const handleEndDateChange = (newDate: DateTime | null) => {
    setTweetFilter({
      ...tweetFilter,
      dateInRange: [tweetFilter.dateInRange[0], newDate || "any"]
    });
  };

  const clearDateRange = () => {
    setTweetFilter({
      ...tweetFilter,
      dateInRange: ["any", "any"]
    });
  };

  return (<>
    <List>
      <ListItem>
        <Typography variant='subtitle2'>
          Cors Proxy Settings
        </Typography>
      </ListItem>
      <ListItem>
        <Box sx={{ minWidth: 120 }}>
          <FormControl fullWidth>
            <InputLabel id="mode-select-label">Mode</InputLabel>
            <Select placeholder="Choose one…"
              labelId="mode-select-label"
              value={config!.mode}
              label="mode"
              onChange={(e) => {
                let v = e.target.value;
                const intValue = Number.parseInt(v.toString());
                const newConfig = intValue === 1 ? defaultConfig : {
                  ...initConfig,
                  mode: intValue,
                  prefix: intValue === 2 ? "" : initConfig.prefix
                };
                _setConfig(newConfig);
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
        }}
          value={prefix}
        />
        <IconButton edge="end" aria-label="comments" onClick={() => {
          _setConfig({
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
            const codingNew = !config!.urlEncoding;
            _setConfig({
              ...initConfig,
              urlEncoding: codingNew
            })
          }}
          checked={config!.urlEncoding}
        />
      </ListItem>
    </List>
    <Divider variant="middle" />
    <List>
      <ListItem>
        <Typography variant='subtitle2'>
          Cache Settings
        </Typography>
      </ListItem>

      <ListItem>
        <Button
          variant="contained"
          onClick={() => {
            const cfg = initConfig;
            localStorage.clear();
            saveToLocal(cfg);
          }}
        >
          Clear Cache
        </Button>
      </ListItem>
    </List>
    <Divider variant="middle" />
    <List>
      <ListItem>
        <Typography variant='subtitle2'>
          Content Settings
        </Typography>
      </ListItem>

      <ListItem>
        <FormGroup>
          <FormControlLabel
            control={<CheckBox checked={includeReply} onChange={(event) => { toggleIncludeReply(event.target.checked) }} />}
            label="Include Replies" />
          <FormControlLabel
            control={<CheckBox checked={includePost} onChange={(event) => { toggleIncludePost(event.target.checked) }} />}
            label="Include Posts" />
        </FormGroup>
      </ListItem>

      <ListItem>
        <ListItemText id="switch-list-label-images" primary="Show Images Only" />
        <Switch
          edge="end"
          inputProps={{
            'aria-labelledby': 'switch-list-label-images',
          }}
          onChange={() => {
            setTweetFilter({
              ...tweetFilter,
              mustContainImage: !tweetFilter.mustContainImage,
            });
          }}
          checked={tweetFilter.mustContainImage}
        />
      </ListItem>
      
      <ListItem>
        <Typography variant='subtitle2'>
          Date Range Filter
        </Typography>
      </ListItem>
      
      <ListItem>
        <LocalizationProvider dateAdapter={AdapterLuxon}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
            <DatePicker
              label="Start Date"
              value={startDate}
              onChange={handleStartDateChange}
              slotProps={{
                textField: { fullWidth: true, size: 'small' },
              }}
            />
            <DatePicker
              label="End Date"
              value={endDate}
              onChange={handleEndDateChange}
              slotProps={{
                textField: { fullWidth: true, size: 'small' },
              }}
            />
            <Button 
              variant="outlined" 
              size="small" 
              onClick={clearDateRange}
              sx={{ alignSelf: 'flex-end' }}
            >
              Clear Date Range
            </Button>
          </Box>
        </LocalizationProvider>
      </ListItem>
    </List>

  </>
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
            <Link href="/" color="inherit" underline='none'>
              OMOT
            </Link>
          </Typography>
          <IconButton
            size='large'
            color='inherit'
            aria-label='github'
            href='https://github.com/ayanamists/oh-my-old-tweet'
            target='_blank'>
            <GitHubIcon />
          </IconButton>
          <IconButton
            size='large'
            color='inherit'
            aria-label='github'
            href='https://github.com/ayanamists/oh-my-old-tweet/wiki/About_CORS_Proxy'
            target='_blank'>
            <HelpIcon />
          </IconButton>
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
          primary: {
            main: '#1DA1F2'
          }
        },
      }),
    [prefersDarkMode]);

  return (
    <ThemeProvider theme={theme}>
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
    </ThemeProvider>);
}

export default MainLayout;
