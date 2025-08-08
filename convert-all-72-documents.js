const axios = require('axios');

async function convertAll72Documents() {
  try {
    console.log('🚀 Starting WebP conversion for all 72 documents...');
    
    // All document IDs from our discovery
    const allDocumentIds = [
      "3524973568157937537", "3627138361957926421", "3659979351587326354", "3667105287026991789",
      "3672872049706144441", "3673055903027999383", "3676391249822795004", "3677869004777618737",
      "3678877755022248052", "3682386149715918184", "3683835303810000176", "3684364055255141400",
      "3684507675094660240", "3684668527500216384", "3685287477468679978", "3685916537278325702",
      "3686161666312193532", "3686713154037977954", "3686745821198730824", "3686776225230182192",
      "3686827252099634947", "3686843518240762741", "3687262869016303971", "3687265000897017926",
      "3687378573321300830", "3687386373418115585", "3687398695528586763", "3687441371245941794",
      "3687442546950195496", "3687514912082619028", "3687548512274299037", "3687587734034366052",
      "3687942941050130546", "3687987591102514515", "3688138708427768265", "3688142756056988861",
      "3688147555666085723", "3688167776858417233", "3688184017328291428", "3688209102782455702",
      "3688274486335052253", "3688274772461949935", "3688712509079127544", "3688758031268535124",
      "3688765690488184901", "3688827307691137412", "3688857383065843692", "3688924747783406062",
      "3689452410509694239", "3689586390254143520", "3689612736749321180", "3689834374676655740",
      "3690343323269581709", "3690424076244978826", "3690886829192513752", "3690932132414344574",
      "3691070879270684716", "3691083376936330476", "3691611488077955379", "3691657097308715028",
      "3691792461500464017", "3691818343124203164", "3691824760468229222", "3692345779704489813",
      "3692373809248333109", "3692381892686096815", "3692485100432668530", "3692532614513641161",
      "3692601955562464395", "3692610750279459615", "Test", "VtNryE9PIozqtS00Y0sc"
    ];
    
    const imageFields = ['Displayurl', 'Image1', 'Image2', 'Image3', 'Image4', 'Image5', 'Image6'];
    
    let totalDocumentsProcessed = 0;
    let totalImagesConverted = 0;
    let totalCompression = 0;
    
    for (let i = 0; i < allDocumentIds.length; i++) {
      const docId = allDocumentIds[i];
      console.log(`\n📄 Processing document ${i + 1}/72: ${docId}`);
      
      let documentImagesConverted = 0;
      let documentCompression = 0;
      
      for (const imageField of imageFields) {
        console.log(`  📸 Converting ${imageField}...`);
        
        try {
          const response = await axios.post('https://us-central1-nocta-d1113.cloudfunctions.net/convertSingleImageToWebP', {
            docId: docId,
            imageField: imageField
          }, {
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (response.data.success) {
            const compression = parseFloat(response.data.compressionRatio);
            console.log(`    ✅ ${imageField}: ${response.data.compressionRatio} compression`);
            documentImagesConverted++;
            documentCompression += compression;
          }
          
        } catch (error) {
          if (error.response?.data?.error?.includes('not found in document')) {
            console.log(`    ⚠️ ${imageField}: Field not found`);
          } else if (error.response?.data?.error?.includes('Document not found')) {
            console.log(`    ❌ ${imageField}: Document not found`);
            break; // Skip to next document if this one doesn't exist
          } else {
            console.log(`    ❌ ${imageField}: ${error.response?.data?.error || error.message}`);
          }
        }
        
        // Wait 500ms between image conversions
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (documentImagesConverted > 0) {
        totalDocumentsProcessed++;
        totalImagesConverted += documentImagesConverted;
        totalCompression += documentCompression;
        
        const avgCompression = (documentCompression / documentImagesConverted).toFixed(1);
        console.log(`  📊 Document summary: ${documentImagesConverted} images converted, avg ${avgCompression}% compression`);
      }
      
      // Wait 2 seconds between documents
      console.log('  ⏳ Waiting 2 seconds before next document...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n🎊 WebP conversion complete!');
    console.log(`📊 Total documents processed: ${totalDocumentsProcessed}/72`);
    console.log(`📊 Total images converted: ${totalImagesConverted}`);
    if (totalImagesConverted > 0) {
      const overallAvgCompression = (totalCompression / totalImagesConverted).toFixed(1);
      console.log(`📊 Average compression: ${overallAvgCompression}%`);
    }
    
  } catch (error) {
    console.error('❌ Error during conversion:', error.response?.data || error.message);
  }
}

convertAll72Documents(); 