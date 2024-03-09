import { Box, TextField } from "@mui/material";
import AccountCircle from '@mui/icons-material/AccountCircle';

type Props = {
  userName: string,
  // eslint-disable-next-line no-unused-vars
  setUser: (userName: string) => void
}

function parseUserName(input: string) {
  const trimInput = input.trim();
  if (trimInput.startsWith("https")) {
    const url = new URL(trimInput);
    const path = url.pathname;
    const first = path.split('/')[1];
    return first;
  } else {
    const userName = mayRemoveAtSym(trimInput);
    return userName;
  }
}

function mayRemoveAtSym(str: string) {
  if (str.charAt(0) === '@') {
    return str.substring(1, str.length);
  } else {
    return str;
  }
}

export default function UserNameInput({ userName, setUser }: Props) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', width: '20em' }}>
      <AccountCircle sx={{ color: 'action.active', mr: 1, my: 0.5 }} />
      <TextField id="input-with-sx" label="usernameOrUrl" variant="standard"
        placeholder={userName}
        sx={{ width: '100%' }}
        onChange={(event) => {
          setUser(parseUserName(event.target.value));
        }} />
    </Box>
  );
}