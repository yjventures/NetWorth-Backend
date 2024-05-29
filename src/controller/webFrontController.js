const { catchAsync } = require('../middleware/catchAsyncError')
const webFrontModel = require('../model/webFrontModel')
const ErrorHandler = require('../utils/errorHandler')

const initValues = {
    // Define your initial values here
    logo: {
        defaultLogo: 'https://example.com/default-logo.png',
        darkLogo: 'https://example.com/dark-logo.png',
    },
    rootPattern: {
        defaultPattern: 'https://example.com/default-root-pattern.png',
        darkPattern: 'https://example.com/dark-root-pattern.png',
    },
    authPattern: {
        defaultPattern: 'https://example.com/default-auth-pattern.png',
        darkPattern: 'https://example.com/dark-auth-pattern.png',
    },
    inboxPattern: {
        defaultPattern: 'https://example.com/default-inbox-pattern.png',
        darkPattern: 'https://example.com/dark-inbox-pattern.png',
    },
    variables: {
        useDefaultTheme: true,
        defaultVariables: {
            background: '#ffffff',
            foreground: '#000000',
            gray_50: '#f9fafb',
            gray_100: '#f3f4f6',
            gray_200: '#e5e7eb',
            card: '#ffffff',
            card_foreground: '#000000',
            popover: '#ffffff',
            popover_foreground: '#000000',
            primary: '#1f2937',
            primary_foreground: '#ffffff',
            secondary: '#3b82f6',
            secondary_foreground: '#ffffff',
            muted: '#6b7280',
            muted_foreground: '#ffffff',
            accent: '#10b981',
            accent_foreground: '#ffffff',
            destructive: '#ef4444',
            destructive_foreground: '#ffffff',
            border: '#e5e7eb',
            input: '#d1d5db',
            ring: '#2563eb',
        },
        darkVariables: {
            background: '#1f2937',
            foreground: '#ffffff',
            gray_50: '#374151',
            gray_100: '#4b5563',
            gray_200: '#6b7280',
            card: '#1f2937',
            card_foreground: '#ffffff',
            popover: '#1f2937',
            popover_foreground: '#ffffff',
            primary: '#f9fafb',
            primary_foreground: '#1f2937',
            secondary: '#3b82f6',
            secondary_foreground: '#1f2937',
            muted: '#9ca3af',
            muted_foreground: '#1f2937',
            accent: '#10b981',
            accent_foreground: '#1f2937',
            destructive: '#ef4444',
            destructive_foreground: '#1f2937',
            border: '#4b5563',
            input: '#374151',
            ring: '#2563eb',
        },
    },
    fontFamily: 'Arial, sans-serif',
    homepageSlider: [
        {
            image: 'https://example.com/slider1.png',
            text: 'Welcome to our website',
        },
        {
            image: 'https://example.com/slider2.png',
            text: 'Enjoy our services',
        },
    ],
}
exports.createWebFront = catchAsync(async (req, res, next) => {
    const reqBody = req.body

    const webFront = await webFrontModel.create(reqBody)
    if (!webFront) {
        return next(new ErrorHandler(400, 'webFront creation failed'))
    }
    return res.status(201).json({
        status: true,
        data: webFront,
    })
})

exports.updateWebFront = catchAsync(async (req, res, next) => {
    let webFront = await WebFront.findOne()

    if (!webFront) {
        webFront = await WebFront.create({ ...initValues })
    }

    const updatedWebFront = await WebFront.findByIdAndUpdate(
        webFront._id,
        req.body,
        {
            new: true, // Return the updated document
            runValidators: true, // Ensure validation is run on update
        },
    )

    res.status(200).json({
        success: true,
        data: updatedWebFront,
    })
})
