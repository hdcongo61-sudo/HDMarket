let ioInstance = null;

export const setChatSocket = (io) => {
  ioInstance = io;
};

export const getChatSocket = () => ioInstance;
