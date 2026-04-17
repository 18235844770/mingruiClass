import { SetMetadata } from '@nestjs/common';

export const SKIP_CAMPUS_CHECK_KEY = 'skipCampusCheck';

export const SkipCampusCheck = () => SetMetadata(SKIP_CAMPUS_CHECK_KEY, true);
