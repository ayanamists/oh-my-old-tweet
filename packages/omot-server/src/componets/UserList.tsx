import { TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody, Link, NoSsr } from "@mui/material";
import { User, UserName } from "@prisma/client";

export type UserListProps = {
  users: (User & UserName)[]
}

export default function UserList({ users }: UserListProps) {
  return (
    <TableContainer component={Paper} sx={{ margin: 'auto' }}>
      <Table aria-label="recent updated user table">
        <TableHead>
          <TableRow>
            <TableCell>User Name</TableCell>
            <TableCell align="left">Display Name</TableCell>
            <TableCell align="left">Last Updated</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((row) => (
            <TableRow
              key={row.id}
              sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
            >
              <TableCell scope="row">
                <Link href={`/user/${row.userName}`}>{row.userName}</Link>
              </TableCell>
              <TableCell align="left">{row.fullName}</TableCell>
              <TableCell align="left">{
                // TODO: for every date, we should use the same format
                <NoSsr>{new Date(row.lastModified).toLocaleString()}</NoSsr>
              }
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
