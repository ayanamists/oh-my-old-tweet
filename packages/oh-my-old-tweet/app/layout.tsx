import './globals.css';

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (<html lang="en">

        <head>
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <meta name="theme-color" content="#000000" />
            <meta name="description" content="A graceful, powerful and easy-to-use tool to see old (including deleted) tweets." />
            <title>Oh my Old Tweet</title>
        </head>

        <body>
            <noscript>You need to enable JavaScript to run this app.</noscript>
            <div id="root">{children}</div>
        </body>

    </html>);
}