export const CREATE_USER = `
  mutation CreateUser($user: CreateUserInput!) {
    createUser(user: $user) {
      id
      email
      displayName
      uuid
      creationDate
      groups {
        id
        displayName
      }
      attributes {
        name
        value
      }
    }
  }
`;

export const UPDATE_USER = `
  mutation UpdateUser($user: UpdateUserInput!) {
    updateUser(user: $user) {
      ok
    }
  }
`;

export const DELETE_USER = `
  mutation DeleteUser($userId: String!) {
    deleteUser(userId: $userId) {
      ok
    }
  }
`;

export const CREATE_GROUP = `
  mutation CreateGroup($name: String!) {
    createGroup(name: $name) {
      id
      displayName
      uuid
      creationDate
    }
  }
`;

export const UPDATE_GROUP = `
  mutation UpdateGroup($group: UpdateGroupInput!) {
    updateGroup(group: $group) {
      ok
    }
  }
`;

export const DELETE_GROUP = `
  mutation DeleteGroup($groupId: Int!) {
    deleteGroup(groupId: $groupId) {
      ok
    }
  }
`;

export const ADD_USER_TO_GROUP = `
  mutation AddUserToGroup($userId: String!, $groupId: Int!) {
    addUserToGroup(userId: $userId, groupId: $groupId) {
      ok
    }
  }
`;

export const REMOVE_USER_FROM_GROUP = `
  mutation RemoveUserFromGroup($userId: String!, $groupId: Int!) {
    removeUserFromGroup(userId: $userId, groupId: $groupId) {
      ok
    }
  }
`;
