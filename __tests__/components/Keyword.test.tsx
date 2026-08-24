import { fireEvent, render, screen } from '@testing-library/react';
import Keyword from '../../components/keywords/Keyword';
import { dummyKeywords } from '../../__mocks__/data';

const keywordProps = {
   keywordData: dummyKeywords[0],
   selected: false,
   index: 0,
   showSCData: false,
   scDataType: '',
   style: {},
   maxTitleColumnWidth: 235,
   refreshkeyword: jest.fn(),
   favoriteKeyword: jest.fn(),
   removeKeyword: jest.fn(),
   selectKeyword: jest.fn(),
   manageTags: jest.fn(),
   showKeywordDetails: jest.fn(),
};
jest.mock('react-chartjs-2', () => ({
   Line: () => null,
 }));
describe('Keyword Component (PoloRank tracking row)', () => {
   it('renders without crashing', async () => {
       render(<Keyword {...keywordProps} />);
       expect(await screen.findByText('compress image')).toBeInTheDocument();
   });
   it('Should Render Position badge Correctly', async () => {
      render(<Keyword {...keywordProps} />);
      const positionElement = document.querySelector('.keyword_position span');
      expect(positionElement?.textContent).toBe('19');
   });
   it('Should Display Position Change arrow (fallback: vs. previous day when no stats)', async () => {
      render(<Keyword {...keywordProps} />);
      const changeElement = document.querySelector('.keyword_change');
      expect(changeElement?.textContent).toBe('▲ 1');
   });
   it('Should use the API stats for the change when present', async () => {
      const withStats = {
         ...dummyKeywords[0],
         stats: {
            best: { position: 3, date: '2022-11-11' },
            changes: {
               d7: { change: 4, position: 23 },
               d30: { change: -2, position: 17 },
               d60: { change: null, position: null },
               d90: { change: null, position: null },
            },
            resultsReceived: 20,
            historyDays: 5,
         },
      };
      render(<Keyword {...keywordProps} keywordData={withStats} compareDays={30} />);
      expect(document.querySelector('.keyword_change')?.textContent).toBe('▼ 2');
      expect(document.querySelector('.keyword_d30')?.textContent).toBe('−2(17)');
      expect(document.querySelector('.keyword_d60')?.textContent).toBe('—');
      expect(document.querySelector('.keyword_best')?.textContent).toBe('3');
   });
   it('Should show "+N" when the keyword was not found', async () => {
      const notFound = { ...dummyKeywords[0], position: 0, lastDepth: 20 };
      render(<Keyword {...keywordProps} keywordData={notFound} />);
      expect(document.querySelector('.keyword_position span')?.textContent).toBe('+20');
   });
   it('Should Display the SERP Page URL', async () => {
      render(<Keyword {...keywordProps} />);
      const positionElement = document.querySelector('.keyword_url');
      expect(positionElement?.textContent).toBe('/');
   });
   it('Should Display the Keyword Options on dots Click', async () => {
      const { container } = render(<Keyword {...keywordProps} />);
      const button = container.querySelector('.keyword_dots');
      if (button) fireEvent.click(button);
      expect(document.querySelector('.keyword_options')).toBeVisible();
   });
   it('Should hide refresh/remove actions for read-only users', async () => {
      const { container } = render(<Keyword {...keywordProps} canRefresh={false} canManage={false} />);
      const button = container.querySelector('.keyword_dots');
      if (button) fireEvent.click(button);
      expect(screen.queryByText('Refrescar posición')).not.toBeInTheDocument();
      expect(screen.queryByText('Quitar keyword')).not.toBeInTheDocument();
      expect(screen.getByText('Ver historial')).toBeInTheDocument();
   });
});
