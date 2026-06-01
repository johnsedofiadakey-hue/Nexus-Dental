// ============================================
// NEXUS DENTAL — Default Consent Templates
// Seeded as global templates (tenantId = null)
// ============================================

export interface DefaultConsentTemplate {
  title: string;
  category: string;
  content: string;
}

export const DEFAULT_CONSENT_TEMPLATES: DefaultConsentTemplate[] = [
  {
    title: "General Dental Treatment Consent",
    category: "general",
    content: `INFORMED CONSENT FOR GENERAL DENTAL TREATMENT

I, the undersigned patient (or authorised representative), consent to the dental examination and treatment recommended by the dental team at this practice.

NATURE OF TREATMENT
I understand that dental treatment may include diagnosis, preventive care, restorative procedures, periodontal therapy, and any other procedures deemed necessary by my dentist following examination and X-ray evaluation.

RISKS AND COMPLICATIONS
I acknowledge that dental procedures carry certain inherent risks, including but not limited to: temporary or prolonged sensitivity, bleeding, swelling, infection, adverse reactions to anaesthetic agents, damage to adjacent teeth or restorations, and in rare cases, injury to nerves resulting in altered sensation.

ALTERNATIVES
I understand that alternatives to recommended treatments have been explained to me, including the option of no treatment, and I am aware of the consequences of declining care, which may include worsening of dental disease, pain, tooth loss, or systemic complications.

RADIOGRAPHS
I consent to the taking of dental radiographs (X-rays) as required for diagnosis and treatment planning. I understand that radiation exposure will be kept to the clinically justifiable minimum using appropriate protective equipment.

PATIENT ACKNOWLEDGEMENT
I confirm that I have had the opportunity to ask questions and that all my questions have been answered to my satisfaction. I understand I may withdraw consent at any time before or during treatment. I confirm I am not aware of any medical conditions or medications that I have not disclosed to the dental team.

By signing this form, I freely and voluntarily consent to the dental care described above.`,
  },
  {
    title: "Tooth Extraction Consent",
    category: "extraction",
    content: `INFORMED CONSENT FOR TOOTH EXTRACTION (EXODONTIA)

I, the undersigned patient (or authorised representative), consent to the extraction of one or more teeth as recommended by my dentist.

NATURE OF PROCEDURE
Tooth extraction involves the removal of a tooth from its socket in the jawbone under local anaesthesia. In some cases, surgical extraction — involving incision of the gum and possible removal of surrounding bone — may be necessary.

RISKS AND COMPLICATIONS
I understand and accept that tooth extraction carries the following risks:
• Pain, swelling, and bruising lasting several days post-procedure
• Bleeding that may require pressure, packing, or sutures
• Infection of the extraction socket (dry socket — alveolar osteitis)
• Damage to adjacent teeth, fillings, or crowns
• Incomplete removal requiring further surgical intervention
• Temporary or permanent numbness/altered sensation if nerves are in close proximity (especially with lower wisdom teeth)
• Sinus involvement if upper back teeth are removed
• Jaw stiffness (trismus) following prolonged mouth opening
• Rare risk of jaw fracture in cases of dense or ankylosed teeth

POST-OPERATIVE CARE
I agree to follow all post-operative instructions provided, including biting on gauze, avoiding smoking, rinsing gently, taking prescribed medications, and attending follow-up appointments.

ALTERNATIVES
I understand that alternatives such as root canal treatment, crown restoration, or orthodontic repositioning may exist and have been discussed with me.

By signing this form, I freely consent to the extraction procedure and acknowledge that no guarantee of outcome has been made.`,
  },
  {
    title: "Root Canal Treatment Consent",
    category: "rct",
    content: `INFORMED CONSENT FOR ROOT CANAL TREATMENT (ENDODONTIC THERAPY)

I, the undersigned patient (or authorised representative), consent to root canal treatment as recommended by my dentist.

NATURE OF PROCEDURE
Root canal treatment involves removing infected or inflamed pulp tissue from the canals within a tooth root, cleaning and shaping the canals, and sealing them with an inert filling material to prevent reinfection. Treatment may require one or more appointments and is typically followed by crown placement to protect the tooth.

RISKS AND COMPLICATIONS
I understand the following risks associated with root canal treatment:
• Temporary post-treatment discomfort, swelling, and sensitivity lasting several days
• Risk of instrument separation within the canal (fine files may occasionally break; management options exist)
• Canal perforation during instrumentation, which may affect the long-term prognosis
• Inability to negotiate all canals due to calcification or complex anatomy
• Reinfection or treatment failure requiring re-treatment or extraction
• Flare-up of acute infection requiring antibiotics or drainage
• Vertical root fracture, particularly in heavily restored teeth
• Bleaching agents or irrigants reaching periapical tissues in rare cases

SUCCESS RATES
Root canal treatment has a high success rate (85–95%); however, success cannot be guaranteed. In some cases, surgical root-end resection (apicoectomy) may be required if non-surgical treatment fails.

ALTERNATIVES
Alternatives include extraction with or without replacement (implant, bridge, or denture). The consequences of no treatment include spreading infection, abscess formation, and possible systemic involvement.

By signing this form, I consent to endodontic treatment and understand that the restoration of the tooth following treatment is a separate procedure.`,
  },
  {
    title: "Dental Implant Consent",
    category: "implant",
    content: `INFORMED CONSENT FOR DENTAL IMPLANT PLACEMENT

I, the undersigned patient (or authorised representative), consent to dental implant surgery as outlined in my treatment plan.

NATURE OF PROCEDURE
A dental implant is a titanium fixture surgically placed into the jawbone to act as an artificial tooth root. Following a healing period of 3–6 months (osseointegration), an abutment and crown, bridge, or denture is attached to restore function and aesthetics.

RISKS AND COMPLICATIONS
I acknowledge the following risks associated with dental implant surgery:
• Surgical risks: infection, bleeding, swelling, bruising, and post-operative pain
• Implant failure to integrate (osseointegration failure), requiring removal
• Damage to adjacent teeth, blood vessels, or nerves during placement
• Altered sensation or numbness (paraesthesia) in the lip, chin, cheek, or tongue — may be temporary or permanent
• Sinus involvement or sinus perforation for upper jaw implants
• Bone loss around the implant (peri-implantitis) requiring treatment
• Implant fracture or component failure over time
• Need for bone grafting procedures prior to or at time of implant placement

SYSTEMIC FACTORS
I understand that certain medical conditions (uncontrolled diabetes, bisphosphonate therapy, radiotherapy, smoking, immunosuppression) significantly increase failure risk and have disclosed all relevant history to my clinician.

LONG-TERM MAINTENANCE
I commit to meticulous oral hygiene and regular professional maintenance visits, understanding that neglect may result in peri-implant disease and implant loss.

ALTERNATIVES
Alternatives include removable dentures and fixed dental bridges. These have been explained and their advantages and disadvantages discussed.

I understand no guarantee is made regarding the longevity of implants and that future interventions may be necessary.`,
  },
  {
    title: "Local Anaesthesia Consent",
    category: "anaesthesia",
    content: `INFORMED CONSENT FOR LOCAL ANAESTHESIA ADMINISTRATION

I, the undersigned patient (or authorised representative), consent to the administration of local anaesthetic agents as required for dental treatment.

NATURE OF PROCEDURE
Local anaesthesia involves the injection of anaesthetic solution (typically lignocaine/lidocaine with or without adrenaline/epinephrine, or an alternative agent) into or around the site of treatment to numb the area and prevent pain during the procedure.

RISKS AND COMPLICATIONS
I acknowledge the following potential risks:
• Temporary soreness or bruising at the injection site
• Haematoma (localised blood pooling) if a blood vessel is inadvertently punctured
• Temporary facial muscle weakness if anaesthetic diffuses to nearby motor nerves (usually resolves within hours)
• Trismus (limited mouth opening) in rare cases following inferior alveolar nerve blocks
• Prolonged numbness beyond the expected duration (rare)
• Allergic or adverse reactions to anaesthetic agents — I have disclosed all known allergies and medical conditions
• Cardiovascular effects from adrenaline/epinephrine: palpitations, increased heart rate (particularly relevant in patients with cardiac conditions)
• Nerve injury (extremely rare) causing prolonged or permanent altered sensation
• Needle breakage (extremely rare)

MEDICAL HISTORY
I confirm that I have provided a complete and accurate medical history including all medications, allergies, previous adverse reactions to anaesthetics, and relevant systemic conditions such as heart disease, liver disease, or blood disorders.

PATIENT RESPONSIBILITY
I will immediately inform the dental team if I experience any unusual sensation, dizziness, difficulty breathing, or palpitations during or after the injection.

By signing, I consent to the administration of local anaesthesia as deemed appropriate by my clinician.`,
  },
  {
    title: "Teeth Whitening Consent",
    category: "whitening",
    content: `INFORMED CONSENT FOR TEETH WHITENING (TOOTH BLEACHING)

I, the undersigned patient (or authorised representative), consent to professional teeth whitening treatment.

NATURE OF TREATMENT
Teeth whitening involves the application of a peroxide-based bleaching agent (hydrogen peroxide or carbamide peroxide) to the tooth surfaces, either in-office under controlled conditions or via custom-fitted take-home trays, to lighten tooth colour.

CANDIDATE SUITABILITY
I understand that whitening is most effective on natural tooth enamel and will not change the colour of existing crowns, veneers, bonding, or tooth-coloured fillings. Any existing restorations may need to be replaced after whitening to match my new shade.

RISKS AND COMPLICATIONS
I acknowledge the following potential effects:
• Tooth sensitivity — during and after treatment; typically transient (days to weeks)
• Gum irritation or chemical burn if bleaching agent contacts soft tissue
• Uneven whitening in areas of enamel defects or fluorosis
• Relapse of colour over time, especially with consumption of staining foods/beverages and tobacco
• Over-bleaching resulting in an artificial, translucent appearance
• Rare risk of pulpal inflammation in teeth with large pulp chambers
• No guaranteed shade outcome — results vary by individual tooth composition

AFTER-CARE
I agree to avoid staining foods and beverages (coffee, tea, red wine, berries) and tobacco for at least 48 hours post-treatment, and to follow all home-care instructions provided.

CONTRAINDICATIONS ACKNOWLEDGED
I confirm I am not pregnant or breastfeeding, am not under 18 years of age, and have disclosed all relevant dental and medical conditions.

I understand results are not permanent and maintenance treatment may be required.`,
  },
];
