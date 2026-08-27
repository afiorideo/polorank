import { timeAgoCompact } from '../../utils/client/timeago';

describe('timeAgoCompact (PoloRank: "Actualizado" column)', () => {
   it('uses numbers with a short unit instead of a sentence', () => {
      expect(timeAgoCompact(1, 'hour')).toBe('1h');
      expect(timeAgoCompact(3, 'day')).toBe('3d');
      expect(timeAgoCompact(12, 'minute')).toBe('12min');
      expect(timeAgoCompact(2, 'week')).toBe('2sem');
      expect(timeAgoCompact(5, 'month')).toBe('5mes');
      expect(timeAgoCompact(1, 'year')).toBe('1a');
   });
   it('says "ahora" for a check that just happened', () => {
      expect(timeAgoCompact(4, 'second')).toBe('ahora');
      expect(timeAgoCompact(50, 'second')).toBe('50s');
   });
});
