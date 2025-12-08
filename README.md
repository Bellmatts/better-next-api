# 🚀 better-next-api - Build APIs Easily and Safely

[![Download](https://img.shields.io/badge/Download-Here-brightgreen?style=for-the-badge)](https://github.com/Bellmatts/better-next-api/releases)

## 📝 Description

better-next-api offers a typesafe and structured way to create API handlers for Next.js applications. This tool allows you to enhance your development experience with features like Zod validation and composable middleware, all while using standard API routes. With better-next-api, you can build reliable and maintainable Next.js applications without any hassle.

## 📦 Features

- **Typesafe API Handlers**: Write secure and error-free code using TypeScript.
- **Zod Validation**: Ensure that input data matches defined types, reducing runtime errors.
- **Composable Middleware**: Create reusable function chains that manage requests efficiently.
- **Easy Integration**: Fits seamlessly into your existing Next.js project structure.
- **User-Friendly**: Designed for developers of all skill levels.

## 🚀 Getting Started

### Prerequisites

Before you download and install better-next-api, ensure you have the following:

- **Operating System**: Works on Windows, macOS, and Linux.
- **Node.js**: Version 14 or higher installed. You can download it from [Node.js official site](https://nodejs.org/).
- **Next.js**: Your project must be built with Next.js (version 12 or later).

### Download & Install

To get better-next-api, visit this page to download: [Releases Page](https://github.com/Bellmatts/better-next-api/releases).

Once you are on the Releases page, choose the latest version. Click on the asset that works for your operating system and follow the instructions to download the file.

### Installation Steps

1. **Download the File**: Click on the link for the latest release above, and save the file to a location on your computer.
2. **Extract the Files**: If the file is compressed (.zip or .tar.gz), extract the contents to a folder you can remember.
3. **Install Dependencies**: Open your terminal or command prompt. Navigate to the folder where you extracted better-next-api.

   For example, if you extracted it to `C:\better-next-api`, you would type:

   ```bash
   cd C:\better-next-api
   ```

   Then run the following command to install necessary packages:

   ```bash
   npm install
   ```

4. **Run the API**: After installing dependencies, start the server by running:

   ```bash
   npm run dev
   ```

5. **Start Building**: Your better-next-api is now running! You can access it in your browser at `http://localhost:3000`.

### Configuration

To customize better-next-api for your project's needs:

1. Open the `src/api` folder in your project.
2. Edit the predefined routes and adapt them as necessary according to your application requirements.
3. Use the Zod validation methods to ensure that your API input data is correct.

### Sample Usage

Here’s a basic example of how you might use better-next-api in a Next.js project.

1. **Create a New API Route**: In the `src/api` folder, create a new file, such as `example.ts`.

2. **Code Example**:

   ```typescript
   import { createRoute } from 'better-next-api';
   import { z } from 'zod';

   const schema = z.object({
       name: z.string(),
       age: z.number().min(0)
   });

   export default createRoute({
       schema,
       handler: async (req, res) => {
           res.status(200).json({ message: `Hello, ${req.body.name}` });
       }
   });
   ```

3. **Test the Route**: Start your Next.js app and make a POST request to `http://localhost:3000/api/example` with the correct JSON format.

### Troubleshooting

- **Server Not Starting**: Ensure Node.js is installed correctly.
- **Dependencies Failing to Install**: Check your internet connection or try running `npm install` again.
- **Validation Errors**: Make sure you follow the Zod validation correctly by providing the right data format.

### Community & Support

For further information and community support, consider checking out our discussion board or contributing to the project. You can report issues on the [Issues Page](https://github.com/Bellmatts/better-next-api/issues).

## 🔗 Additional Resources

- **Documentation**: To understand better how to use better-next-api, refer to the comprehensive documentation available on the GitHub wiki.
- **Forums**: Join our community on platforms like Discord or Stack Overflow to discuss and share insights about API development.

## 📥 Download Again

Don’t hesitate! To download better-next-api again, just click this link: [Releases Page](https://github.com/Bellmatts/better-next-api/releases). Enjoy building robust APIs with ease!