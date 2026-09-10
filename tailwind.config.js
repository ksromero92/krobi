export default {
    darkMode: 'class', // 👈 activa el modo oscuro por clase
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                krobi: {
                    DEFAULT: "#03A688",
                    dark: "#02886F",
                    light: "#E0F7F3",
                },
            },
        },
    },
    plugins: [],
};
