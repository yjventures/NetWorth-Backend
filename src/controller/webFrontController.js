const { catchAsync } = require('../middleware/catchAsyncError');
const webFrontModel = require('../model/webFrontModel');
const ErrorHandler = require('../utils/errorHandler');

const initValues = {
  logo: {
    defaultLogo:
      'http://rfqbucket.s3-website-ap-southeast-2.amazonaws.com/fb7036d87073ebd8c56b2713626922b65f2f6b1d5a92965656a2ce1179731d5c.jpeg',
    darkLogo: '',
  },
  rootPattern: {
    defaultPattern:
      'http://rfqbucket.s3-website-ap-southeast-2.amazonaws.com/f8bbdbc43a53aa7960b74702367d5fb149474eb46315290057446d4d477c4378.png',
    darkPattern: '',
  },
  authPattern: {
    defaultPattern:
      'http://rfqbucket.s3-website-ap-southeast-2.amazonaws.com/d1f34ea4b7ad9b8245318fab915ae25ca8772fabbdafaf299b493d1df5d82fde.png',
    darkPattern: '',
  },
  inboxPattern: {
    defaultPattern:
      'http://rfqbucket.s3-website-ap-southeast-2.amazonaws.com/5d53c7e56d6c618e3b898889c2cce9840b3b3ef3444d2370e94838e60b24e9eb.png',
    darkPattern: '',
  },
  variables: {
    useDefaultTheme: true,
    defaultVariables: {
      background: '#ffffff',
      foreground: '#020817',
      gray_50: '#f9fafb',
      gray_100: '#f3f4f6',
      gray_200: '#e5e7eb',
      card: '#ffffff',
      card_foreground: '#020817',
      popover: '#ffffff',
      popover_foreground: '#020817',
      primary: '#2563eb',
      primary_foreground: '#f8fafc',
      secondary: '#f1f5f9',
      secondary_foreground: '#3a1d19',
      tartiary: '#eb996e',
      tartiary_foreground: '#eb996e',
      muted: '#f1f5f9',
      muted_foreground: '#64748b',
      accent: '#f1f5f9',
      accent_foreground: '#0f172a',
      destructive: '#ef4444',
      destructive_foreground: '#f8fafc',
      border: '#e2e8f0',
      input: '#e2e8f0',
      ring: '#2563eb',
      radius: '0.5rem',
    },
    darkVariables: {
      background: '#020817',
      foreground: '#f8fafc',
      gray_50: '#374151',
      gray_100: '#1f2937',
      gray_200: '#111827',
      card: '#020817',
      card_foreground: '#f8fafc',
      popover: '#020817',
      popover_foreground: '#f8fafc',
      primary: '#3b82f6',
      primary_foreground: '#0f172a',
      secondary: '#1e293b',
      secondary_foreground: '#f8fafc',
      tartiary: '#eb996e',
      tartiary_foreground: '#eb996e',
      muted: '#1e293b',
      muted_foreground: '#94a3b8',
      accent: '#1e293b',
      accent_foreground: '#f8fafc',
      destructive: '#7f1d1d',
      destructive_foreground: '#f8fafc',
      border: '#1e293b',
      input: '#1e293b',
      ring: '#1d4ed8',
      radius: '0.5rem',
    },
  },
  fontFamily: 'Arial, sans-serif',
  homepageSlider: {
    first: {
      image1:
        'http://rfqbucket.s3-website-ap-southeast-2.amazonaws.com/9664f9fec61737580f02abde2d8c7fe53644a19e53a2eb1e3c563ad7f5b72918.png',
      text: 'Welcome to our website',
    },
    second: {
      image1:
        'http://rfqbucket.s3-website-ap-southeast-2.amazonaws.com/6465e0d42c634c96b0c982dc5997d2ae38a3bbf511bcff93de8171cc04db6253.png',
      text: 'Enjoy our services',
    },
    third: {
      image1:
        'http://rfqbucket.s3-website-ap-southeast-2.amazonaws.com/9e81463c08fa83bbb597f19c2e6ced361afab308a015826fa525e3caaaee3f9d.png',
      text: 'Check out our new features',
    },
  },
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

  if (webFront) {
    // const updatedData = { req.body };

    const updatedWebFront = await webFrontModel.findByIdAndUpdate(webFront._id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: updatedWebFront,
    });
  } else {
    const createwebFront = await webFrontModel.create(req.body);

    if (!createwebFront) {
      return next(new ErrorHandler(400, 'webFront creation failed'));
    }

    return res.status(201).json({
      success: true,
      data: createwebFront,
    });
  }
});

exports.getWebFront = catchAsync(async (req, res, next) => {
  let webFront = await webFrontModel.findOne();
  const type = req.query.type;

  if (!webFront) {
    return next(new ErrorHandler(400, 'webFront customization not found'));
  }

  let responseData;

  switch (type) {
    case 'logo':
      responseData = {
        logo: webFront.logo,
      };
      break;
    case 'patterns':
      responseData = {
        rootPattern: webFront.rootPattern,
        authPattern: webFront.authPattern,
        inboxPattern: webFront.inboxPattern,
      };
      break;
    case 'variables':
      responseData = {
        variables: webFront.variables,
      };
      break;
    case 'homepage':
      responseData = {
        homepageSlider: webFront.homepageSlider,
      };
      break;
    default:
      responseData = webFront;
      break;
  }

  res.status(200).json({
    success: true,
    data: responseData,
  });
});
