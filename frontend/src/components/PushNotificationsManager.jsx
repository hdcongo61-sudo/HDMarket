import { useContext } from 'react';
import AuthContext from '../context/AuthContext';
import usePushNotifications from '../hooks/usePushNotifications';

export default function PushNotificationsManager() {
  const { user } = useContext(AuthContext);
  usePushNotifications(user);
  return null;
}
