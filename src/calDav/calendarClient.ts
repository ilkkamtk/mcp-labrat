import { DAVClient } from 'tsdav';

let clientPromise: Promise<DAVClient> | null = null;

const getAuthenticatedClient = () => {
  // If a login is already in progress or finished, return that same promise
  if (clientPromise) return clientPromise;

  // Otherwise, create the promise and store it
  clientPromise = (async () => {
    const client = new DAVClient({
      serverUrl: 'http://localhost:5232/',
      credentials: { username: 'username', password: 'password' },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    });

    try {
      await client.login();
      return client;
    } catch (error) {
      clientPromise = null; // Reset so we can try again later
      throw error;
    }
  })();

  return clientPromise;
};

export { getAuthenticatedClient };
