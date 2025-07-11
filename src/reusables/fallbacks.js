const Fallback = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Innovator Server</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: linear-gradient(135deg, #4a00e0, #8e2de2);
            color: white;
            text-align: center;
          }
          h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
          }
          p {
            font-size: 1.2rem;
            opacity: 0.8;
          }
        </style>
      </head>
      <body>
        <div>
          <h1>🚀 Innovator Server Running!</h1>
          <p>Your backend is set up and ready to go.</p>
        </div>
      </body>
      </html>
    `;

module.exports = Fallback;
