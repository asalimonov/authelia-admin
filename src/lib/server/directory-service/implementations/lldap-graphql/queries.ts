export const LIST_USERS = `
  query ListUsers {
    users {
      id
      email
      displayName
    }
  }
`;

export const GET_USER = `
  query GetUser($userId: String!) {
    user(userId: $userId) {
      id
      email
      displayName
      uuid
      creationDate
      groups {
        id
        displayName
        uuid
      }
      attributes {
        name
        value
      }
    }
  }
`;

export const LIST_GROUPS = `
  query ListGroups {
    groups {
      id
      displayName
      uuid
    }
  }
`;

export const GET_GROUP = `
  query GetGroup($groupId: Int!) {
    group(groupId: $groupId) {
      id
      displayName
      uuid
      creationDate
      users {
        id
        email
        displayName
      }
      attributes {
        name
        value
      }
    }
  }
`;

export const GET_SCHEMA = `
  query GetSchema {
    schema {
      userSchema {
        attributes {
          name
          attributeType
          isList
          isVisible
          isEditable
          isReadonly
        }
      }
      groupSchema {
        attributes {
          name
          attributeType
          isList
          isVisible
          isEditable
          isReadonly
        }
      }
    }
  }
`;

export const GET_API_VERSION = `
  query {
    apiVersion
  }
`;
