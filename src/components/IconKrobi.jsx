import krobiHiIco from "../assets/krobi_hi_ico.ico";

export default function IconKrobi({ size = 20, animated = false }) {
    return (
        <img
            src={krobiHiIco}
            alt="KroBi"
            className={`object-contain drop-shadow-sm transition-transform duration-300 ease-in-out ${animated ? "scale-100 rotate-0" : ""
                }`}
            style={{ width: size, height: size }}
        />
    );
}
