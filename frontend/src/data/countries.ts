// Comprehensive ISO 3166-1 alpha-2 countries and territories dataset
// Includes country name, alpha-2 code, flag emoji, and international calling codes.

export interface Country {
  code: string; // ISO 3166-1 alpha-2 code (uppercase)
  name: string; // English common name
  flag: string; // Unicode flag emoji
  callingCodes: string[]; // E.164 calling codes e.g. ["+1"], ["+91"]
}

export interface CallingCodeOption {
  id: string; // Unique key e.g. "US-+1", "CA-+1"
  countryCode: string;
  countryName: string;
  flag: string;
  callingCode: string; // e.g. "+1"
}

// Convert 2-letter ISO code to unicode flag emoji
export function getCountryFlag(alpha2: string): string {
  if (!alpha2 || alpha2.length !== 2) return "🌐";
  const upper = alpha2.toUpperCase();
  const codePoints = [...upper].map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export const COUNTRIES: Country[] = [
  { code: "AF", name: "Afghanistan", flag: "🇦🇫", callingCodes: ["+93"] },
  { code: "AX", name: "Åland Islands", flag: "🇦🇽", callingCodes: ["+358"] },
  { code: "AL", name: "Albania", flag: "🇦🇱", callingCodes: ["+355"] },
  { code: "DZ", name: "Algeria", flag: "🇩🇿", callingCodes: ["+213"] },
  { code: "AS", name: "American Samoa", flag: "🇦🇸", callingCodes: ["+1"] },
  { code: "AD", name: "Andorra", flag: "🇦🇩", callingCodes: ["+376"] },
  { code: "AO", name: "Angola", flag: "🇦🇴", callingCodes: ["+244"] },
  { code: "AI", name: "Anguilla", flag: "🇦🇮", callingCodes: ["+1"] },
  { code: "AQ", name: "Antarctica", flag: "🇦🇶", callingCodes: ["+672"] },
  { code: "AG", name: "Antigua and Barbuda", flag: "🇦🇬", callingCodes: ["+1"] },
  { code: "AR", name: "Argentina", flag: "🇦🇷", callingCodes: ["+54"] },
  { code: "AM", name: "Armenia", flag: "🇦🇲", callingCodes: ["+374"] },
  { code: "AW", name: "Aruba", flag: "🇦🇼", callingCodes: ["+297"] },
  { code: "AU", name: "Australia", flag: "🇦🇺", callingCodes: ["+61"] },
  { code: "AT", name: "Austria", flag: "🇦🇹", callingCodes: ["+43"] },
  { code: "AZ", name: "Azerbaijan", flag: "🇦🇿", callingCodes: ["+994"] },
  { code: "BS", name: "Bahamas", flag: "🇧🇸", callingCodes: ["+1"] },
  { code: "BH", name: "Bahrain", flag: "🇧🇭", callingCodes: ["+973"] },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩", callingCodes: ["+880"] },
  { code: "BB", name: "Barbados", flag: "🇧🇧", callingCodes: ["+1"] },
  { code: "BY", name: "Belarus", flag: "🇧🇾", callingCodes: ["+375"] },
  { code: "BE", name: "Belgium", flag: "🇧🇪", callingCodes: ["+32"] },
  { code: "BZ", name: "Belize", flag: "🇧🇿", callingCodes: ["+501"] },
  { code: "BJ", name: "Benin", flag: "🇧🇯", callingCodes: ["+229"] },
  { code: "BM", name: "Bermuda", flag: "🇧🇲", callingCodes: ["+1"] },
  { code: "BT", name: "Bhutan", flag: "🇧🇹", callingCodes: ["+975"] },
  { code: "BO", name: "Bolivia", flag: "🇧🇴", callingCodes: ["+591"] },
  { code: "BA", name: "Bosnia and Herzegovina", flag: "🇧🇦", callingCodes: ["+387"] },
  { code: "BW", name: "Botswana", flag: "🇧🇼", callingCodes: ["+267"] },
  { code: "BV", name: "Bouvet Island", flag: "🇧🇻", callingCodes: ["+47"] },
  { code: "BR", name: "Brazil", flag: "🇧🇷", callingCodes: ["+55"] },
  { code: "IO", name: "British Indian Ocean Territory", flag: "🇮🇴", callingCodes: ["+246"] },
  { code: "BN", name: "Brunei Darussalam", flag: "🇧🇳", callingCodes: ["+673"] },
  { code: "BG", name: "Bulgaria", flag: "🇧🇬", callingCodes: ["+359"] },
  { code: "BF", name: "Burkina Faso", flag: "🇧🇫", callingCodes: ["+226"] },
  { code: "BI", name: "Burundi", flag: "🇧🇮", callingCodes: ["+257"] },
  { code: "KH", name: "Cambodia", flag: "🇰🇭", callingCodes: ["+855"] },
  { code: "CM", name: "Cameroon", flag: "🇨🇲", callingCodes: ["+237"] },
  { code: "CA", name: "Canada", flag: "🇨🇦", callingCodes: ["+1"] },
  { code: "CV", name: "Cape Verde", flag: "🇨🇻", callingCodes: ["+238"] },
  { code: "KY", name: "Cayman Islands", flag: "🇰🇾", callingCodes: ["+1"] },
  { code: "CF", name: "Central African Republic", flag: "🇨🇫", callingCodes: ["+236"] },
  { code: "TD", name: "Chad", flag: "🇹🇩", callingCodes: ["+235"] },
  { code: "CL", name: "Chile", flag: "🇨🇱", callingCodes: ["+56"] },
  { code: "CN", name: "China", flag: "🇨🇳", callingCodes: ["+86"] },
  { code: "CX", name: "Christmas Island", flag: "🇨🇽", callingCodes: ["+61"] },
  { code: "CC", name: "Cocos (Keeling) Islands", flag: "🇨🇨", callingCodes: ["+61"] },
  { code: "CO", name: "Colombia", flag: "🇨🇴", callingCodes: ["+57"] },
  { code: "KM", name: "Comoros", flag: "🇰🇲", callingCodes: ["+269"] },
  { code: "CG", name: "Congo", flag: "🇨🇬", callingCodes: ["+242"] },
  { code: "CD", name: "Congo, Democratic Republic of the", flag: "🇨🇩", callingCodes: ["+243"] },
  { code: "CK", name: "Cook Islands", flag: "🇨🇰", callingCodes: ["+682"] },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷", callingCodes: ["+506"] },
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮", callingCodes: ["+225"] },
  { code: "HR", name: "Croatia", flag: "🇭🇷", callingCodes: ["+385"] },
  { code: "CU", name: "Cuba", flag: "🇨🇺", callingCodes: ["+53"] },
  { code: "CW", name: "Curaçao", flag: "🇨🇼", callingCodes: ["+599"] },
  { code: "CY", name: "Cyprus", flag: "🇨🇾", callingCodes: ["+357"] },
  { code: "CZ", name: "Czech Republic", flag: "🇨🇿", callingCodes: ["+420"] },
  { code: "DK", name: "Denmark", flag: "🇩🇰", callingCodes: ["+45"] },
  { code: "DJ", name: "Djibouti", flag: "🇩🇯", callingCodes: ["+253"] },
  { code: "DM", name: "Dominica", flag: "🇩🇲", callingCodes: ["+1"] },
  { code: "DO", name: "Dominican Republic", flag: "🇩🇴", callingCodes: ["+1"] },
  { code: "EC", name: "Ecuador", flag: "🇪🇨", callingCodes: ["+593"] },
  { code: "EG", name: "Egypt", flag: "🇪🇬", callingCodes: ["+20"] },
  { code: "SV", name: "El Salvador", flag: "🇸🇻", callingCodes: ["+503"] },
  { code: "GQ", name: "Equatorial Guinea", flag: "🇬🇶", callingCodes: ["+240"] },
  { code: "ER", name: "Eritrea", flag: "🇪🇷", callingCodes: ["+291"] },
  { code: "EE", name: "Estonia", flag: "🇪🇪", callingCodes: ["+372"] },
  { code: "SZ", name: "Eswatini", flag: "🇸🇿", callingCodes: ["+268"] },
  { code: "ET", name: "Ethiopia", flag: "🇪🇹", callingCodes: ["+251"] },
  { code: "FK", name: "Falkland Islands (Malvinas)", flag: "🇫🇰", callingCodes: ["+500"] },
  { code: "FO", name: "Faroe Islands", flag: "🇫🇴", callingCodes: ["+298"] },
  { code: "FJ", name: "Fiji", flag: "🇫🇯", callingCodes: ["+679"] },
  { code: "FI", name: "Finland", flag: "🇫🇮", callingCodes: ["+358"] },
  { code: "FR", name: "France", flag: "🇫🇷", callingCodes: ["+33"] },
  { code: "GF", name: "French Guiana", flag: "🇬🇫", callingCodes: ["+594"] },
  { code: "PF", name: "French Polynesia", flag: "🇵🇫", callingCodes: ["+689"] },
  { code: "TF", name: "French Southern Territories", flag: "🇹🇫", callingCodes: ["+262"] },
  { code: "GA", name: "Gabon", flag: "🇬🇦", callingCodes: ["+241"] },
  { code: "GM", name: "Gambia", flag: "🇬🇲", callingCodes: ["+220"] },
  { code: "GE", name: "Georgia", flag: "🇬🇪", callingCodes: ["+995"] },
  { code: "DE", name: "Germany", flag: "🇩🇪", callingCodes: ["+49"] },
  { code: "GH", name: "Ghana", flag: "🇬🇭", callingCodes: ["+233"] },
  { code: "GI", name: "Gibraltar", flag: "🇬🇮", callingCodes: ["+350"] },
  { code: "GR", name: "Greece", flag: "🇬🇷", callingCodes: ["+30"] },
  { code: "GL", name: "Greenland", flag: "🇬🇱", callingCodes: ["+299"] },
  { code: "GD", name: "Grenada", flag: "🇬🇩", callingCodes: ["+1"] },
  { code: "GP", name: "Guadeloupe", flag: "🇬🇵", callingCodes: ["+590"] },
  { code: "GU", name: "Guam", flag: "🇬🇺", callingCodes: ["+1"] },
  { code: "GT", name: "Guatemala", flag: "🇬🇹", callingCodes: ["+502"] },
  { code: "GG", name: "Guernsey", flag: "🇬🇬", callingCodes: ["+44"] },
  { code: "GN", name: "Guinea", flag: "🇬🇳", callingCodes: ["+224"] },
  { code: "GW", name: "Guinea-Bissau", flag: "🇬🇼", callingCodes: ["+245"] },
  { code: "GY", name: "Guyana", flag: "🇬🇾", callingCodes: ["+592"] },
  { code: "HT", name: "Haiti", flag: "🇭🇹", callingCodes: ["+509"] },
  { code: "VA", name: "Holy See (Vatican City State)", flag: "🇻🇦", callingCodes: ["+39", "+379"] },
  { code: "HN", name: "Honduras", flag: "🇭🇳", callingCodes: ["+504"] },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰", callingCodes: ["+852"] },
  { code: "HU", name: "Hungary", flag: "🇭🇺", callingCodes: ["+36"] },
  { code: "IS", name: "Iceland", flag: "🇮🇸", callingCodes: ["+354"] },
  { code: "IN", name: "India", flag: "🇮🇳", callingCodes: ["+91"] },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", callingCodes: ["+62"] },
  { code: "IR", name: "Iran, Islamic Republic of", flag: "🇮🇷", callingCodes: ["+98"] },
  { code: "IQ", name: "Iraq", flag: "🇮🇶", callingCodes: ["+964"] },
  { code: "IE", name: "Ireland", flag: "🇮🇪", callingCodes: ["+353"] },
  { code: "IM", name: "Isle of Man", flag: "🇮🇲", callingCodes: ["+44"] },
  { code: "IL", name: "Israel", flag: "🇮🇱", callingCodes: ["+972"] },
  { code: "IT", name: "Italy", flag: "🇮🇹", callingCodes: ["+39"] },
  { code: "JM", name: "Jamaica", flag: "🇯🇲", callingCodes: ["+1"] },
  { code: "JP", name: "Japan", flag: "🇯🇵", callingCodes: ["+81"] },
  { code: "JE", name: "Jersey", flag: "🇯🇪", callingCodes: ["+44"] },
  { code: "JO", name: "Jordan", flag: "🇯🇴", callingCodes: ["+962"] },
  { code: "KZ", name: "Kazakhstan", flag: "🇰🇿", callingCodes: ["+7"] },
  { code: "KE", name: "Kenya", flag: "🇰🇪", callingCodes: ["+254"] },
  { code: "KI", name: "Kiribati", flag: "🇰🇮", callingCodes: ["+686"] },
  { code: "KP", name: "Korea, Democratic People's Republic of", flag: "🇰🇵", callingCodes: ["+850"] },
  { code: "KR", name: "Korea, Republic of", flag: "🇰🇷", callingCodes: ["+82"] },
  { code: "KW", name: "Kuwait", flag: "🇰🇼", callingCodes: ["+965"] },
  { code: "KG", name: "Kyrgyzstan", flag: "🇰🇬", callingCodes: ["+996"] },
  { code: "LA", name: "Lao People's Democratic Republic", flag: "🇱🇦", callingCodes: ["+856"] },
  { code: "LV", name: "Latvia", flag: "🇱🇻", callingCodes: ["+371"] },
  { code: "LB", name: "Lebanon", flag: "🇱🇧", callingCodes: ["+961"] },
  { code: "LS", name: "Lesotho", flag: "🇱🇸", callingCodes: ["+266"] },
  { code: "LR", name: "Liberia", flag: "🇱🇷", callingCodes: ["+231"] },
  { code: "LY", name: "Libya", flag: "🇱🇾", callingCodes: ["+218"] },
  { code: "LI", name: "Liechtenstein", flag: "🇱🇮", callingCodes: ["+423"] },
  { code: "LT", name: "Lithuania", flag: "🇱🇹", callingCodes: ["+370"] },
  { code: "LU", name: "Luxembourg", flag: "🇱🇺", callingCodes: ["+352"] },
  { code: "MO", name: "Macao", flag: "🇲🇴", callingCodes: ["+853"] },
  { code: "MG", name: "Madagascar", flag: "🇲🇬", callingCodes: ["+261"] },
  { code: "MW", name: "Malawi", flag: "🇲🇼", callingCodes: ["+265"] },
  { code: "MY", name: "Malaysia", flag: "🇲🇾", callingCodes: ["+60"] },
  { code: "MV", name: "Maldives", flag: "🇲🇻", callingCodes: ["+960"] },
  { code: "ML", name: "Mali", flag: "🇲🇱", callingCodes: ["+223"] },
  { code: "MT", name: "Malta", flag: "🇲🇹", callingCodes: ["+356"] },
  { code: "MH", name: "Marshall Islands", flag: "🇲🇭", callingCodes: ["+692"] },
  { code: "MQ", name: "Martinique", flag: "🇲🇶", callingCodes: ["+596"] },
  { code: "MR", name: "Mauritania", flag: "🇲🇷", callingCodes: ["+222"] },
  { code: "MU", name: "Mauritius", flag: "🇲🇺", callingCodes: ["+230"] },
  { code: "YT", name: "Mayotte", flag: "🇾🇹", callingCodes: ["+262"] },
  { code: "MX", name: "Mexico", flag: "🇲🇽", callingCodes: ["+52"] },
  { code: "FM", name: "Micronesia, Federated States of", flag: "🇫🇲", callingCodes: ["+691"] },
  { code: "MD", name: "Moldova, Republic of", flag: "🇲🇩", callingCodes: ["+373"] },
  { code: "MC", name: "Monaco", flag: "🇲🇨", callingCodes: ["+377"] },
  { code: "MN", name: "Mongolia", flag: "🇲🇳", callingCodes: ["+976"] },
  { code: "ME", name: "Montenegro", flag: "🇲🇪", callingCodes: ["+382"] },
  { code: "MS", name: "Montserrat", flag: "🇲🇸", callingCodes: ["+1"] },
  { code: "MA", name: "Morocco", flag: "🇲🇦", callingCodes: ["+212"] },
  { code: "MZ", name: "Mozambique", flag: "🇲🇿", callingCodes: ["+258"] },
  { code: "MM", name: "Myanmar", flag: "🇲🇲", callingCodes: ["+95"] },
  { code: "NA", name: "Namibia", flag: "🇳🇦", callingCodes: ["+264"] },
  { code: "NR", name: "Nauru", flag: "🇳🇷", callingCodes: ["+674"] },
  { code: "NP", name: "Nepal", flag: "🇳🇵", callingCodes: ["+977"] },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", callingCodes: ["+31"] },
  { code: "NC", name: "New Caledonia", flag: "🇳🇨", callingCodes: ["+687"] },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿", callingCodes: ["+64"] },
  { code: "NI", name: "Nicaragua", flag: "🇳🇮", callingCodes: ["+505"] },
  { code: "NE", name: "Niger", flag: "🇳🇪", callingCodes: ["+227"] },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", callingCodes: ["+234"] },
  { code: "NU", name: "Niue", flag: "🇳🇺", callingCodes: ["+683"] },
  { code: "NF", name: "Norfolk Island", flag: "🇳🇫", callingCodes: ["+672"] },
  { code: "MK", name: "North Macedonia", flag: "🇲🇰", callingCodes: ["+389"] },
  { code: "MP", name: "Northern Mariana Islands", flag: "🇲🇵", callingCodes: ["+1"] },
  { code: "NO", name: "Norway", flag: "🇳🇴", callingCodes: ["+47"] },
  { code: "OM", name: "Oman", flag: "🇴🇲", callingCodes: ["+968"] },
  { code: "PK", name: "Pakistan", flag: "🇵🇰", callingCodes: ["+92"] },
  { code: "PW", name: "Palau", flag: "🇵🇼", callingCodes: ["+680"] },
  { code: "PS", name: "Palestine, State of", flag: "🇵🇸", callingCodes: ["+970"] },
  { code: "PA", name: "Panama", flag: "🇵🇦", callingCodes: ["+507"] },
  { code: "PG", name: "Papua New Guinea", flag: "🇵🇬", callingCodes: ["+675"] },
  { code: "PY", name: "Paraguay", flag: "🇵🇾", callingCodes: ["+595"] },
  { code: "PE", name: "Peru", flag: "🇵🇪", callingCodes: ["+51"] },
  { code: "PH", name: "Philippines", flag: "🇵🇭", callingCodes: ["+63"] },
  { code: "PN", name: "Pitcairn", flag: "🇵🇳", callingCodes: ["+64"] },
  { code: "PL", name: "Poland", flag: "🇵🇱", callingCodes: ["+48"] },
  { code: "PT", name: "Portugal", flag: "🇵🇹", callingCodes: ["+351"] },
  { code: "PR", name: "Puerto Rico", flag: "🇵🇷", callingCodes: ["+1"] },
  { code: "QA", name: "Qatar", flag: "🇶🇦", callingCodes: ["+974"] },
  { code: "RE", name: "Réunion", flag: "🇷🇪", callingCodes: ["+262"] },
  { code: "RO", name: "Romania", flag: "🇷🇴", callingCodes: ["+40"] },
  { code: "RU", name: "Russian Federation", flag: "🇷🇺", callingCodes: ["+7"] },
  { code: "RW", name: "Rwanda", flag: "🇷🇼", callingCodes: ["+250"] },
  { code: "BL", name: "Saint Barthélemy", flag: "🇧🇱", callingCodes: ["+590"] },
  { code: "SH", name: "Saint Helena, Ascension and Tristan da Cunha", flag: "🇸🇭", callingCodes: ["+290"] },
  { code: "KN", name: "Saint Kitts and Nevis", flag: "🇰🇳", callingCodes: ["+1"] },
  { code: "LC", name: "Saint Lucia", flag: "🇱🇨", callingCodes: ["+1"] },
  { code: "MF", name: "Saint Martin (French part)", flag: "🇲🇫", callingCodes: ["+590"] },
  { code: "PM", name: "Saint Pierre and Miquelon", flag: "🇵🇲", callingCodes: ["+508"] },
  { code: "VC", name: "Saint Vincent and the Grenadines", flag: "🇻🇨", callingCodes: ["+1"] },
  { code: "WS", name: "Samoa", flag: "🇼🇸", callingCodes: ["+685"] },
  { code: "SM", name: "San Marino", flag: "🇸🇲", callingCodes: ["+378"] },
  { code: "ST", name: "Sao Tome and Principe", flag: "🇸🇹", callingCodes: ["+239"] },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", callingCodes: ["+966"] },
  { code: "SN", name: "Senegal", flag: "🇸🇳", callingCodes: ["+221"] },
  { code: "RS", name: "Serbia", flag: "🇷🇸", callingCodes: ["+381"] },
  { code: "SC", name: "Seychelles", flag: "🇸🇨", callingCodes: ["+248"] },
  { code: "SL", name: "Sierra Leone", flag: "🇸🇱", callingCodes: ["+232"] },
  { code: "SG", name: "Singapore", flag: "🇸🇬", callingCodes: ["+65"] },
  { code: "SX", name: "Sint Maarten (Dutch part)", flag: "🇸🇽", callingCodes: ["+1"] },
  { code: "SK", name: "Slovakia", flag: "🇸🇰", callingCodes: ["+421"] },
  { code: "SI", name: "Slovenia", flag: "🇸🇮", callingCodes: ["+386"] },
  { code: "SB", name: "Solomon Islands", flag: "🇸🇧", callingCodes: ["+677"] },
  { code: "SO", name: "Somalia", flag: "🇸🇴", callingCodes: ["+252"] },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", callingCodes: ["+27"] },
  { code: "GS", name: "South Georgia and the South Sandwich Islands", flag: "🇬🇸", callingCodes: ["+500"] },
  { code: "SS", name: "South Sudan", flag: "🇸🇸", callingCodes: ["+211"] },
  { code: "ES", name: "Spain", flag: "🇪🇸", callingCodes: ["+34"] },
  { code: "LK", name: "Sri Lanka", flag: "🇱🇰", callingCodes: ["+94"] },
  { code: "SD", name: "Sudan", flag: "🇸🇩", callingCodes: ["+249"] },
  { code: "SR", name: "Suriname", flag: "🇸🇷", callingCodes: ["+597"] },
  { code: "SJ", name: "Svalbard and Jan Mayen", flag: "🇸🇯", callingCodes: ["+47"] },
  { code: "SE", name: "Sweden", flag: "🇸🇪", callingCodes: ["+46"] },
  { code: "CH", name: "Switzerland", flag: "🇨🇭", callingCodes: ["+41"] },
  { code: "SY", name: "Syrian Arab Republic", flag: "🇸🇾", callingCodes: ["+963"] },
  { code: "TW", name: "Taiwan, Province of China", flag: "🇹🇼", callingCodes: ["+886"] },
  { code: "TJ", name: "Tajikistan", flag: "🇹🇯", callingCodes: ["+992"] },
  { code: "TZ", name: "Tanzania, United Republic of", flag: "🇹🇿", callingCodes: ["+255"] },
  { code: "TH", name: "Thailand", flag: "🇹🇭", callingCodes: ["+66"] },
  { code: "TL", name: "Timor-Leste", flag: "🇹🇱", callingCodes: ["+670"] },
  { code: "TG", name: "Togo", flag: "🇹🇬", callingCodes: ["+228"] },
  { code: "TK", name: "Tokelau", flag: "🇹🇰", callingCodes: ["+690"] },
  { code: "TO", name: "Tonga", flag: "🇹🇴", callingCodes: ["+676"] },
  { code: "TT", name: "Trinidad and Tobago", flag: "🇹🇹", callingCodes: ["+1"] },
  { code: "TN", name: "Tunisia", flag: "🇹🇳", callingCodes: ["+216"] },
  { code: "TR", name: "Turkey", flag: "🇹🇷", callingCodes: ["+90"] },
  { code: "TM", name: "Turkmenistan", flag: "🇹🇲", callingCodes: ["+993"] },
  { code: "TC", name: "Turks and Caicos Islands", flag: "🇹🇨", callingCodes: ["+1"] },
  { code: "TV", name: "Tuvalu", flag: "🇹🇻", callingCodes: ["+688"] },
  { code: "UG", name: "Uganda", flag: "🇺🇬", callingCodes: ["+256"] },
  { code: "UA", name: "Ukraine", flag: "🇺🇦", callingCodes: ["+380"] },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", callingCodes: ["+971"] },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", callingCodes: ["+44"] },
  { code: "US", name: "United States", flag: "🇺🇸", callingCodes: ["+1"] },
  { code: "UM", name: "United States Minor Outlying Islands", flag: "🇺🇲", callingCodes: ["+1"] },
  { code: "UY", name: "Uruguay", flag: "🇺🇾", callingCodes: ["+598"] },
  { code: "UZ", name: "Uzbekistan", flag: "🇺🇿", callingCodes: ["+998"] },
  { code: "VU", name: "Vanuatu", flag: "🇻🇺", callingCodes: ["+678"] },
  { code: "VE", name: "Venezuela, Bolivarian Republic of", flag: "🇻🇪", callingCodes: ["+58"] },
  { code: "VN", name: "Viet Nam", flag: "🇻🇳", callingCodes: ["+84"] },
  { code: "VG", name: "Virgin Islands, British", flag: "🇻🇬", callingCodes: ["+1"] },
  { code: "VI", name: "Virgin Islands, U.S.", flag: "🇻🇮", callingCodes: ["+1"] },
  { code: "WF", name: "Wallis and Futuna", flag: "🇼🇫", callingCodes: ["+681"] },
  { code: "EH", name: "Western Sahara", flag: "🇪🇭", callingCodes: ["+212"] },
  { code: "YE", name: "Yemen", flag: "🇾🇪", callingCodes: ["+967"] },
  { code: "ZM", name: "Zambia", flag: "🇿🇲", callingCodes: ["+260"] },
  { code: "ZW", name: "Zimbabwe", flag: "🇿🇼", callingCodes: ["+263"] },
];

// Lookup map by ISO 3166-1 alpha-2 code
export const COUNTRIES_BY_CODE = new Map<string, Country>(
  COUNTRIES.map((c) => [c.code.toUpperCase(), c])
);

// Flat list of country calling codes, supporting duplicates (e.g. +1 for US, CA, etc.)
export const CALLING_CODE_OPTIONS: CallingCodeOption[] = COUNTRIES.flatMap((c) =>
  c.callingCodes.map((callingCode) => ({
    id: `${c.code}-${callingCode}`,
    countryCode: c.code,
    countryName: c.name,
    flag: c.flag,
    callingCode,
  }))
).sort((a, b) => {
  // Common codes first for ergonomics: US, IN, GB, CA, AU, DE, FR, JP
  const priority = ["US-+1", "IN-+91", "GB-+44", "CA-+1", "AU-+61", "DE-+49", "FR-+33", "JP-+81"];
  const aIdx = priority.indexOf(a.id);
  const bIdx = priority.indexOf(b.id);
  if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
  if (aIdx !== -1) return -1;
  if (bIdx !== -1) return 1;
  return a.countryName.localeCompare(b.countryName);
});

// Helper to find best calling code option by country code or calling code string
export function findCallingCodeOption(
  countryCode?: string | null,
  callingCode?: string | null
): CallingCodeOption | undefined {
  if (countryCode) {
    const match = CALLING_CODE_OPTIONS.find(
      (opt) => opt.countryCode.toUpperCase() === countryCode.toUpperCase()
    );
    if (match) return match;
  }
  if (callingCode) {
    const formatted = callingCode.startsWith("+") ? callingCode : `+${callingCode}`;
    const match = CALLING_CODE_OPTIONS.find((opt) => opt.callingCode === formatted);
    if (match) return match;
  }
  return undefined;
}
