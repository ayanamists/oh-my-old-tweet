import { Box, TextField } from "@mui/material";
import AccountCircle from '@mui/icons-material/AccountCircle';

type Props = {
  userName: string,
  // eslint-disable-next-line no-unused-vars
  setUser: (userName: string) => void
}

export default function UserNameInput({ userName, setUser }: Props) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', width: '20em' }}>
      <AccountCircle sx={{ color: 'action.active', mr: 1, my: 0.5 }} />
      <TextField id="input-with-sx" label="username" variant="standard"
        placeholder={userName}
        sx={{ width: '100%' }}
        onChange={(event) => {
          setUser(event.target.value);
        }} />
    </Box>
  );
}