import GithubIcon from '@your-org/ui-lib/icons/social/github.svg';
import { css } from '@emotion/react';

export const MainLayout: React.FC = (props) => {
  const { children } = props;
  return (
    <div className="flex flex-col h-screen">
      <main>{children}</main>
      <footer>
        <GithubIcon
          css={css`
            fill: black;
          `}
        />
      </footer>
    </div>
  );
};
