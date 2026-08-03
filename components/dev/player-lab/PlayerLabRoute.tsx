import { Redirect } from 'expo-router';

/** Release fail-closed route for direct links into the development-only lab. */
export function PlayerLabRoute() {
  return <Redirect href="/" />;
}
