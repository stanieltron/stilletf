"use client";

const imgNewTwitter = "/assets/social_twitter.svg";
const imgLinkedin02 = "/assets/social_linkedin.svg";
const imgTelegram = "/assets/social_telegram.svg";

export default function Footer() {
  const year = "2026";

  return (
    <footer className="w-full bg-white">
      {/* Figma: padding: 24px 24px 40px; height: 398px */}
      <div className="w-full flex justify-center px-6 pt-6 pb-10">
        {/* Frame 36: width 1080, height 334, gap 16, isolation isolate */}
        <div
          className="relative w-[1080px] max-w-[1080px] h-[334px] flex flex-col items-center gap-4 isolate"
        >
          {/* Big word: z-index 0 */}
          <div className="relative w-full h-[274px] flex items-end justify-center">
            <div className="w-full text-center select-none text-[#F7F3EB] font-bold tracking-[-0.03em] leading-[100%] text-[273.883px]">
              stillwater
            </div>

            <div className="absolute left-[1045px] top-[217px] text-[#645C4A] font-normal text-[13px] leading-[140%]">
              {year}
            </div>
          </div>

          {/* Socials row: width 224, height 44, gap 16 */}
          <div className="flex items-center justify-center w-[224px] h-[44px] gap-4 text-[#645C4A]">
            <a
              href="https://x.com/sonaetf"
              target="_blank"
              rel="noreferrer"
              className="w-16 h-11 bg-[#F7F3EB] rounded-full flex items-center justify-center transition-all hover:bg-[#efe6d8] hover:scale-[1.04] active:scale-95"
              aria-label="Stillwater on X"
            >
              <img
                src={imgNewTwitter}
                alt="X logo"
                className="h-8 w-8"
              />
            </a>

            <a
              href="https://www.linkedin.com/company/sona-etf/"
              target="_blank"
              rel="noreferrer"
              className="w-16 h-11 bg-[#F7F3EB] rounded-full flex items-center justify-center transition-all hover:bg-[#efe6d8] hover:scale-[1.04] active:scale-95"
              aria-label="Stillwater on LinkedIn"
            >
              <img
                src={imgLinkedin02}
                alt="LinkedIn logo"
                className="h-8 w-8"
              />
            </a>

            <a
              href="https://t.me/sonaetf"
              target="_blank"
              rel="noreferrer"
              className="w-16 h-11 bg-[#F7F3EB] rounded-full flex items-center justify-center transition-all hover:bg-[#efe6d8] hover:scale-[1.04] active:scale-95"
              aria-label="Stillwater on Telegram"
            >
              <img
                src={imgTelegram}
                alt="Telegram logo"
                className="h-8 w-8"
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

