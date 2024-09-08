import React, { useState, useEffect } from 'react';
import { useRefinementList } from 'react-instantsearch';
import {
  Box, Checkbox, List, ListItem, Button
} from '@mui/material';


type UserIdToName = Map<string, { userName: string, fullName: string }>;

function CustomRefinementList() {
  const {
    items,
    refine,
    canRefine,
    canToggleShowMore,
    isShowingMore,
    toggleShowMore,
  } = useRefinementList({
    attribute: 'userId',
    showMore: true,
    limit: 20,
    showMoreLimit: 50
  });

  const [userNames, setUserNames] = useState<UserIdToName>(new Map());

  useEffect(() => {
    const userIds = items.map(item => item.value);

    const fetchUserNames = async () => {
      const response = await fetch('/api/userNames', {
        method: 'POST',
        body: JSON.stringify({ userIds })
      });
      const users = await response.json();

      const newUserNames = new Map();
      users.forEach((user: { userId: string, userName: string, fullName: string }) => {
        newUserNames.set(user.userId.toString(), { userName: user.userName, fullName: user.fullName });
      });
      setUserNames(newUserNames);
    };

    if (userIds.length > 0) {
      fetchUserNames();
    }
  }, [items]);

  return (
    <Box>
      {canRefine ? (
        <List>
          {items.map((item) => (
            <ListItem
              key={item.label}
              dense
              sx={{ paddingTop: 0, paddingBottom: 0 }}
            >
              <Box sx={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', width: '100%'
              }}>
                <Checkbox
                  checked={item.isRefined}
                  onChange={() => refine(item.value)}
                  sx={{ padding: 0, marginRight: 1 }}
                />
                <Box>{getText(userNames, item.label)}</Box>
                <Box
                  sx={{
                    fontFamily: 'monofont',
                    color: 'primary.main',
                    marginLeft: 'auto',
                  }}
                >
                  {item.count}
                </Box>
              </Box>
            </ListItem>
          ))}
        </List>
      ) : (
        <p>No refinements available</p>
      )}

      <Button
        onClick={toggleShowMore}
        disabled={!canToggleShowMore}
        variant="contained"
        fullWidth
      >
        {isShowingMore ? 'Show less' : 'Show more'}
      </Button>
    </Box>
  );
}

function getNameString(name: string) {
  const header = name.substring(0, 6);
  if (header === name) return header;
  else return `${header} ...`;
}

function getText(m: UserIdToName, id: string) {
  const data = m.get(id);
  if (data == null) return id;
  return (<>
    {getNameString(data.fullName)}
    <Box fontFamily={'monofont'}>
      {data.userName}
    </Box>
  </>);
}

export default CustomRefinementList;
