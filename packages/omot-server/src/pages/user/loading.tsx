import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, FormControl, FormControlLabel, FormGroup,
  FormLabel, Radio, RadioGroup, Snackbar, Stack, Typography
} from "@mui/material";
import MainLayout from "@/layouts/MainLayout";
import { useState } from "react";
import { SyntheticEvent } from "react";
import SendIcon from '@mui/icons-material/Send';
import { useCallback } from "react";
import React from "react";
import UserNameInput from "@/componets/UserNameInput";
import { GetServerSideProps } from "next";

type LoadingProps = {
  userName: string
  falseRedirect: boolean
}

export default function Loading({ userName, falseRedirect }: LoadingProps) {
  const [archiveOrgChecked, setArchiveOrgChecked] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setTwitterChecked] = useState(false);
  const [user, setUser] = useState(userName);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertText, setAlertText] = useState("");
  const [alertType, setAlertType] = useState<"error" | "success">("error");
  const [downloadMode, setDownloadMode] = useState("normal");

  const handleArchiveOrgChange = (_: SyntheticEvent, checked: boolean) => {
    setArchiveOrgChecked(checked);
  };

  const handleTwitterChange = (_: SyntheticEvent, checked: boolean) => {
    setTwitterChecked(checked);
  };

  const handleAlertClose = () => {
    setAlertOpen(false);
  }

  const handleSubmit = useCallback(() => {
    fetch(`/api/loadArchive/`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user, downloadMode })
    }).then((res) => {
      if (res.ok) {
        setAlertText("Data Loading Started !");
        setAlertType("success");
        setAlertOpen(true)
      } else {
        throw new Error(`Failed to start loading: ${res.status} (${res.statusText})`);
      }
    }).catch((err) => {
      setAlertText(err.message);
      setAlertType("error");
      setAlertOpen(true);
    });
  }, [user, downloadMode]);

  return (
    <>
      <MainLayout>
        <Stack direction="column" spacing='20px' alignItems={'left'}>
          {(falseRedirect &&
            <Alert variant="outlined" severity="error" sx={{ width: '100%' }}>
              Requested user <Typography color='InfoText'>@{userName}</Typography>
              is not found, please load this user first.
            </Alert>
          )}
          <Typography variant="h2">
            Loading Data
          </Typography>

          <UserNameInput userName={user} setUser={setUser} />

          <FormControl>
            <FormLabel id="mode-selection-group">Download Mode</FormLabel>
            <RadioGroup
              aria-labelledby="mode-selection-group"
              name="controlled-radio-buttons-group"
              value={downloadMode}
              onChange={(event) => {
                setDownloadMode(event.target.value);
              }}
            >
              <FormControlLabel value="normal" control={<Radio />} label="Normal" />
              <FormControlLabel value="overwrite" control={<Radio />} label="Overwrite" />
            </RadioGroup>
          </FormControl>
          <Box>
            <Typography variant="h6">Sources: </Typography>
            <FormGroup>
              <FormControlLabel
                control={<Checkbox defaultChecked />}
                label="Archive.org"
                onChange={handleArchiveOrgChange} />
              <FormControlLabel
                disabled
                control={<Checkbox />}
                label="Twitter.com (Not Implemented)"
                onChange={handleTwitterChange} />
            </FormGroup>
          </Box>

          <Box>
            <Button variant="contained" endIcon={<SendIcon />}
              onClick={() => {
                if (user == null || user.length === 0) {
                  setAlertText("Username cannot be empty");
                  setAlertOpen(true);
                  setAlertType("error");
                } else if (!archiveOrgChecked) {
                  setAlertText("Please select at least one source");
                  setAlertOpen(true);
                  setAlertType("error");
                } else {
                  setDialogOpen(true);
                }
              }}>
              Load
            </Button>
          </Box>
        </Stack>
      </MainLayout>

      <Dialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
        }}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {"Loading Data?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            <p>Are you sure to load data of user
              <Typography color={'InfoText'}>{`@${user}`}</Typography>
              from archive.org?</p>
            This operation may consume quite a lot of time.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDialogOpen(false);
          }}>No</Button>
          <Button onClick={() => {
            setDialogOpen(false);
            handleSubmit();
          }} autoFocus>
            Yes
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={alertOpen} autoHideDuration={6000} onClose={handleAlertClose}
        anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}>
        <Alert onClose={handleAlertClose} severity={alertType} sx={{ width: '100%' }}>
          {alertText}
        </Alert>
      </Snackbar>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<object> =
  async (context) => {
    const userName = context.query?.userName ?? "";
    const falseRedirect = context.query?.falseRedirect ?? false;
    return {
      props: { userName, falseRedirect }
    }
  }
