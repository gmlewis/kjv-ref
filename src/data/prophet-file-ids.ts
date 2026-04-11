/**
 * Prophet file storage IDs for large reference data files.
 * These were uploaded once via `prophet files upload` and are accessed
 * at runtime via the Prophet `useFile()` hook, which returns a presigned
 * download URL that works with plain fetch().
 *
 * To re-upload: run `bun scripts/upload-reference-data.ts`
 */

export const PROPHET_FILE_IDS = {
  /** Full KJV text (31K lines) */
  kjvTxt: 'f188dbfa-2f2c-4e6d-9d64-bd39852faade',

  /** Strong's Hebrew lexicon */
  strongsHebrew: '82b06eac-1b46-4028-bc0e-aafd4b8f67b9',
  /** Strong's Greek lexicon */
  strongsGreek: '5f5f1f58-9272-48ac-9843-69df3d8308a9',
  /** Strong's word→verse index */
  strongsWordIndex: '45024d85-e7f9-4129-9835-d2bd9d067039',

  /** Full WLC Hebrew OT text (for interlinear fallback) */
  interlinearHebrew: '930df74b-e38a-410f-a3b5-4f7386f0a887',
  /** Full TR Greek NT text (for interlinear fallback) */
  interlinearGreek: '5ba091cc-205e-4584-ad5b-0fe03626f454',

  /** Per-book STEPBible interlinear word data */
  interlinearWords: {
    '1Chr': '58096ab7-4455-4c27-8353-aa1c03e8c97d',
    '1Cor': 'a25d02b9-fb12-4aa1-a562-566edeb428ba',
    '1Jn':  '90f35ab6-4ba2-4855-963a-3f0e6d1d2eca',
    '1Ki':  '5b29de1e-d76f-436b-b570-d82543a18f02',
    '1Pet': '2aaffa25-f212-4b52-a7db-f07185840d07',
    '1Sm':  'adc7ee6a-3a28-4d69-9ffd-788d99957d3e',
    '1Th':  '90534b4c-0135-4db4-90db-3a6b6f34abfa',
    '1Tim': '7b34f665-63d9-44ea-8bda-a42fb895338d',
    '2Chr': 'a81ff253-942d-427b-8fda-2e672e9913ba',
    '2Cor': '40b47f89-adb4-4a8e-8eee-f16cfdf7f5af',
    '2Jn':  '711f51e9-91fe-49d1-8f1e-29454b666abc',
    '2Ki':  '6863e01a-7a87-476b-a18e-ff43e2274e80',
    '2Pet': '7479c488-7ffe-4412-9201-64dacf289035',
    '2Sm':  'c60a6f86-81ac-463a-893e-b4e922f7a6fa',
    '2Th':  'ede65009-cb4d-4d1b-a82a-3eb5fe5f727d',
    '2Tim': 'caae97f1-2aca-4a96-9178-3141f601e80d',
    '3Jn':  'e3e25dd9-fcd5-4b12-9e70-217c62b98237',
    'Acts': '287b5172-d6d1-4d14-80d8-7d3709b3b16b',
    'Amos': 'e0f50628-9d78-42fb-b8c6-bccef9bea4ea',
    'Col':  '7768be96-116d-4b73-a0fb-cb70baf9711e',
    'Dan':  '1430f6e5-b433-4109-89fc-47b824970a67',
    'Deu':  '05bd8082-cec0-4ff8-b1cc-785704cc4a6a',
    'Eccl': '09bb265f-f7b5-40a0-86c5-d0a0f031b464',
    'Eph':  '90532bd5-e6fd-40bc-bf28-4956a1da610c',
    'Est':  '969d1f0b-9ca1-4fb1-94a9-8a26d4371f35',
    'Exo':  'c868c497-4f58-49a0-822e-a69ec12dae73',
    'Eze':  '1f07e891-4296-4dda-bea9-9f3bf2b7c9ad',
    'Ezra': '6e96ce8c-d801-4b8b-aaae-68d00c69bdef',
    'Gal':  'b5daa9f0-9890-4b36-aa92-c3f05b11c10a',
    'Ge':   '8c763cc8-d3e0-4c71-9edf-366523ded0b8',
    'Hab':  'd2c558a0-320d-40ac-98ae-d2d5eab6d296',
    'Hag':  'dd806b32-7699-41b8-bf99-8edc4bf1b4bb',
    'Heb':  '43122f05-ceb8-4144-8170-5e9290625418',
    'Hos':  '14aec5ed-db6a-4648-bac7-988fb7cd4d5e',
    'Isa':  '6b6cf224-2ab2-45a9-819f-20c85a0e6f77',
    'Jas':  'ac77d2d3-8bc6-468f-a1cb-fc843fb112d1',
    'Jdgs': '64d9757b-84c1-4241-a547-35ea8aea8fe9',
    'Jer':  '9cae2b08-9cd5-4350-aa2a-5b2debe73f88',
    'Job':  '05594cb8-6f9f-4ab8-8e6a-b2b1c89ab3ed',
    'Joel': '9d2e07d9-9f24-4647-9bec-420c672a2682',
    'John': 'd5e479da-9161-4bc2-9f33-2a9d76902608',
    'Jonah':'f50b5292-6ae5-4304-a99e-ca09c61181f5',
    'Josh': '892f2a92-f83c-4e91-9426-9351817fdc03',
    'Jude': '19c1b55c-e501-4747-8d71-c9708fc142a2',
    'Lam':  'e2ede8fd-f514-4f91-bf37-6f087854c49b',
    'Lev':  'ad7fb19a-f6d4-4a25-a89c-b74aacf1eaf4',
    'Luke': '67d560db-025d-4b79-a3ae-2cbf6f32c63c',
    'Mal':  'ebb1bbde-8873-460f-a809-d80ced937eb6',
    'Mark': '259e0184-e363-488b-9e18-3f3c35ffbfb5',
    'Mat':  'eb5eccce-d469-4118-ad09-d261d705beda',
    'Mic':  '09ce9ee5-a007-4c09-afad-b2f8c696331d',
    'Nahum':'9031b830-2f29-4061-b005-7010c8885ca7',
    'Neh':  '531429ad-b64b-4d42-8b82-3b1352967b89',
    'Num':  '9a61b009-2665-4806-995f-6fa2bb4e0cdd',
    'Obad': '3f11e741-ad48-4c39-8a6d-ad43c8b9b831',
    'Phi':  'bb7d9943-2ab4-418c-bd4c-a6529a5904af',
    'Phmn': '6a13faf3-1f5e-4835-8706-6426ec4dd6dc',
    'Prv':  '26c3ab06-4108-490a-873e-c75c198f14b4',
    'Psa':  'b9901d47-01fd-4287-af12-f49a48d95301',
    'Rev':  '307a8351-c7d3-44d7-8ca8-795b888100ef',
    'Rom':  '1b3fb07a-9bdc-4bfe-aeb1-f2c9b29490d6',
    'Ruth': '423f200c-9d34-4feb-9e57-6cd4fdcbfe6e',
    'SSol': '814d3918-3100-470b-a1ff-909d7ca44ab1',
    'Titus':'844be881-0db1-4bc7-9452-76f287843dc1',
    'Zec':  '055a73cb-2896-4cd1-84ff-cbc647b3c041',
    'Zep':  'e0f9a749-4962-4086-8032-22880d51bdb8',
  } as Record<string, string>,
} as const;
