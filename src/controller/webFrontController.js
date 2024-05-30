const { catchAsync } = require('../middleware/catchAsyncError');
const webFrontModel = require('../model/webFrontModel');
const ErrorHandler = require('../utils/errorHandler');

const initValues = {
  logo: {
    defaultLogo:
      'http://rfqbucket.s3-website-ap-southeast-2.amazonaws.com/fb7036d87073ebd8c56b2713626922b65f2f6b1d5a92965656a2ce1179731d5c.jpeg',
    darkLogo: 'fdsfsdfsfsdf',
  },
  rootPattern: {
    defaultPattern:
      'http://rfqbucket.s3-website-ap-southeast-2.amazonaws.com/f8bbdbc43a53aa7960b74702367d5fb149474eb46315290057446d4d477c4378.png',
    darkPattern: 'sdfsdfsdf',
  },
  authPattern: {
    defaultPattern:
      'http://rfqbucket.s3-website-ap-southeast-2.amazonaws.com/d1f34ea4b7ad9b8245318fab915ae25ca8772fabbdafaf299b493d1df5d82fde.png',
    darkPattern: 'sdfsdfsdfsd',
  },
  inboxPattern: {
    defaultPattern:
      'http://rfqbucket.s3-website-ap-southeast-2.amazonaws.com/5d53c7e56d6c618e3b898889c2cce9840b3b3ef3444d2370e94838e60b24e9eb.png',
    darkPattern: 'sdfsdfsfsd',
  },
  variables: {
    useDefaultTheme: true,
    defaultVariables: {
      background: '#ffffff',
      foreground: '#1c0000',
      gray_50: '#fafafa',
      gray_100: '#f3f3f3',
      gray_200: '#e8e8e8',
      card: '#ffffff',
      card_foreground: '#1c0000',
      popover: '#ffffff',
      popover_foreground: '#1c0000',
      primary: '#1e40ff',
      primary_foreground: '#f8f8ff',
      secondary: '#f3f3f5',
      secondary_foreground: '#2e1212',
      tartiary: '#f3f3f5',
      tartiary_foreground: '#757575',
      muted: '#f3f3f5',
      muted_foreground: '#2e1212',
      accent: '#ff1a1a',
      accent_foreground: '#f8f8ff',
      destructive: '#d9d9d9',
      destructive_foreground: '#d9d9d9',
      border: '#1e40ff',
      input: '#d9d9d9',
      ring: '#1e40ff',
      radius: '0.5rem',
    },
    darkVariables: {
      background: '#1c0000',
      foreground: '#f8f8ff',
      gray_50: '#444444',
      gray_100: '#2b2b2b',
      gray_200: '#1c1c1c',
      card: '#1c0000',
      card_foreground: '#f8f8ff',
      popover: '#1c0000',
      popover_foreground: '#f8f8ff',
      primary: '#1e4fff',
      primary_foreground: '#2e1212',
      secondary: '#1c1c1c',
      secondary_foreground: '#f8f8ff',
      tartiary: '#f3f3f5',
      tartiary_foreground: '#757575',
      muted: '#1c1c1c',
      muted_foreground: '#a5a5a5',
      accent: '#1c1c1c',
      accent_foreground: '#f8f8ff',
      destructive: '#9f1a1a',
      destructive_foreground: '#f8f8ff',
      border: '#1c1c1c',
      input: '#1c1c1c',
      ring: '#3c7dff',
    },
  },
  fontFamily: 'Arial, sans-serif',
  homepageSlider: [
    {
      image1:
        'http://rfqbucket.s3-website-ap-southeast-2.amazonaws.com/9664f9fec61737580f02abde2d8c7fe53644a19e53a2eb1e3c563ad7f5b72918.png',
      image2:
        'http://rfqbucket.s3-website-ap-southeast-2.amazonaws.com/9664f9fec61737580f02abde2d8c7fe53644a19e53a2eb1e3c563ad7f5b72918.png',
      text: 'Welcome to our website',
    },
    {
      image1:
        'http://rfqbucket.s3-website-ap-southeast-2.amazonaws.com/6465e0d42c634c96b0c982dc5997d2ae38a3bbf511bcff93de8171cc04db6253.png',
      text: 'Enjoy our services',
    },
    {
      image1:
        'http://rfqbucket.s3-website-ap-southeast-2.amazonaws.com/9e81463c08fa83bbb597f19c2e6ced361afab308a015826fa525e3caaaee3f9d.png',
      text: 'Check out our new features',
    },
  ],
};

exports.useDefaultWebFront = catchAsync(async (req, res, next) => {
  let webFront = await webFrontModel.findOne();

  if (webFront) {
    await webFrontModel.findByIdAndDelete(webFront?._id);
  }

  webFront = await webFrontModel.create({ ...initValues });

  res.status(200).json({
    success: true,
    data: webFront,
  });
});

exports.createWebFront = catchAsync(async (req, res, next) => {
  const reqBody = req.body;

  const webFront = await webFrontModel.create(reqBody);
  if (!webFront) {
    return next(new ErrorHandler(400, 'webFront creation failed'));
  }
  return res.status(201).json({
    status: true,
    data: webFront,
  });
});

exports.updateWebFront = catchAsync(async (req, res, next) => {
  let webFront = await webFrontModel.findOne();
  // console.log(webFront);

  if (!webFront) {
    webFront = await webFrontModel.create({ ...initValues });

    res.status(200).json({
      success: true,
      data: webFront,
    });
  } else {
    // Merge existing webFront data with incoming request data
    const updatedData = { ...webFront.toObject(), ...req.body };

    const updatedWebFront = await webFrontModel.findByIdAndUpdate(webFront._id, updatedData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: updatedWebFront,
    });
  }
});

exports.getWebFront = catchAsync(async (req, res, next) => {
  let webFront = await webFrontModel.findOne();

  if (!webFront) {
    return next(new ErrorHandler(400, 'webFront not found'));
  }

  res.status(200).json({
    success: true,
    data: webFront,
  });
});
