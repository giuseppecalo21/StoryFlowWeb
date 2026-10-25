<?php
/**
 * StoryFlow Studio 3.3 - Acquisizione articoli WP REST + RSS/Atom in tempo reale (Zero-Cache).
 */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

function sf_error($status, $message) {
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}
function sf_public_url($url) {
    if (!is_string($url) || strlen($url) > 2048) return false;
    $u = parse_url(trim($url));
    if (!$u || !isset($u['scheme'], $u['host']) || !in_array(strtolower($u['scheme']), ['http','https'], true)) return false;
    if (isset($u['user']) || isset($u['pass']) || isset($u['fragment'])) return false;
    $host = strtolower(rtrim($u['host'], '.'));
    if (!$host || strlen($host) > 253 || strpos($host,'.') === false || !preg_match('/^[a-z0-9.-]+$/', $host)) return false;
    if (filter_var($host, FILTER_VALIDATE_IP) || preg_match('/(?:^|\.)(?:localhost|local|internal|test|invalid)$/', $host)) return false;
    $port = $u['port'] ?? ($u['scheme'] === 'https' ? 443 : 80);
    if (!in_array((int)$port, [80,443], true)) return false;
    $addresses = gethostbynamel($host);
    if (!is_array($addresses) || !$addresses) return false;
    foreach ($addresses as $ip) {
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) return false;
    }
    return ['url'=>$url,'host'=>$host,'port'=>(int)$port,'ip'=>$addresses[0]];
}
function sf_resolve_redirect($base,$location) {
    $location = trim($location);
    if (preg_match('~^https?://~i', $location)) return $location;
    $p = parse_url($base);
    if (strpos($location, '//') === 0) return $p['scheme'] . ':' . $location;
    $origin = $p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '');
    if (strpos($location, '/') === 0) return $origin . $location;
    $path = $p['path'] ?? '/';
    return $origin . substr($path,0,strrpos($path,'/')+1) . $location;
}
function sf_get($url, $maxBytes, $timeout = 12) {
    if (!function_exists('curl_init')) throw new RuntimeException('Estensione PHP cURL non disponibile');
    for ($hops=0; $hops<4; $hops++) {
        $check=sf_public_url($url);
        if (!$check) throw new RuntimeException('Indirizzo remoto non valido o non pubblico');
        $out='';$headers=[];$tooLarge=false;
        $ch=curl_init($url);
        curl_setopt_array($ch,[
            CURLOPT_FOLLOWLOCATION=>false,
            CURLOPT_RETURNTRANSFER=>false,
            CURLOPT_FRESH_CONNECT=>true,
            CURLOPT_FORBID_REUSE=>true,
            CURLOPT_CONNECTTIMEOUT=>min($timeout,6),
            CURLOPT_TIMEOUT=>$timeout,
            CURLOPT_USERAGENT=>'Mozilla/5.0 (Windows NT 10.0; Win64; x64) StoryFlowStudio/3.3',
            CURLOPT_SSL_VERIFYPEER=>true,
            CURLOPT_SSL_VERIFYHOST=>2,
            CURLOPT_RESOLVE=>[$check['host'].':'.$check['port'].':'.$check['ip']],
            CURLOPT_IPRESOLVE=>CURL_IPRESOLVE_V4,
            CURLOPT_HTTPHEADER=>[
                'Accept: application/json, application/rss+xml, application/atom+xml, application/xml, text/xml, image/*;q=0.8, */*;q=0.2',
                'Cache-Control: no-cache, no-store, must-revalidate',
                'Pragma: no-cache',
                'Expires: 0'
            ],
            CURLOPT_HEADERFUNCTION=>function($ch,$line) use (&$headers) {
                $p=explode(':',$line,2);
                if(count($p)===2) $headers[strtolower(trim($p[0]))]=trim($p[1]);
                return strlen($line);
            },
            CURLOPT_WRITEFUNCTION=>function($ch,$chunk) use (&$out,$maxBytes,&$tooLarge) {
                if (strlen($out)+strlen($chunk)>$maxBytes) {$tooLarge=true;return 0;}
                $out.=$chunk;return strlen($chunk);
            }
        ]);
        if (defined('CURLOPT_PROTOCOLS')) curl_setopt($ch,CURLOPT_PROTOCOLS,CURLPROTO_HTTP|CURLPROTO_HTTPS);
        $ok=curl_exec($ch);$code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);
        $error=curl_error($ch);curl_close($ch);
        if ($tooLarge) throw new RuntimeException('Risposta remota troppo grande');
        if (in_array($code,[301,302,303,307,308],true) && !empty($headers['location'])) {
            $url=sf_resolve_redirect($url,$headers['location']);continue;
        }
        if (!$ok) throw new RuntimeException('Download non riuscito: '.($error ?: 'errore rete'));
        return ['status'=>$code,'body'=>$out,'type'=>$headers['content-type']??''];
    }
    throw new RuntimeException('Troppi reindirizzamenti');
}
function sf_strip($text) {return trim(html_entity_decode(strip_tags((string)$text),ENT_QUOTES|ENT_HTML5,'UTF-8'));}
function sf_img_in_html($html) {
    if (preg_match('~<img\b[^>]*(?:data-src|src)=[\'\"]([^\'\"]+)~i',(string)$html,$m)) return html_entity_decode($m[1],ENT_QUOTES|ENT_HTML5,'UTF-8');
    return '';
}
function sf_image_url($url) {return sf_public_url($url) ? $url : '';}
function sf_wp_items($raw, $limit) {
    $posts=json_decode($raw,true);
    if (!is_array($posts) || !array_is_list_compat($posts)) return null;
    $items=[];
    foreach(array_slice($posts,0,$limit) as $p) {
        if(!is_array($p) || empty($p['link']))continue;
        $image=$p['_embedded']['wp:featuredmedia'][0]['source_url'] ?? ($p['jetpack_featured_media_url'] ?? '');
        if (!$image && !empty($p['content']['rendered'])) {
            $image = sf_img_in_html($p['content']['rendered']);
        }
        $items[]=[
            'id'=>(string)($p['id']??substr(sha1($p['link']),0,12)),
            'title'=>sf_strip($p['title']['rendered']??''),
            'url'=>$p['link'], 'date'=>$p['date']??'',
            'image'=>sf_image_url($image)
        ];
    }
    return $items;
}
function array_is_list_compat($a) {
    if (!is_array($a)) return false;
    $i=0;foreach($a as $k=>$v)if($k!==$i++)return false;
    return true;
}
function sf_rss_items($raw,$limit) {
    if (!function_exists('simplexml_load_string')) throw new RuntimeException('Il server PHP non ha SimpleXML per leggere RSS/Atom');
    $before=libxml_use_internal_errors(true);
    $xml=simplexml_load_string($raw,'SimpleXMLElement',LIBXML_NONET|LIBXML_NOCDATA);
    libxml_clear_errors();libxml_use_internal_errors($before);
    if(!$xml) throw new RuntimeException('Feed RSS/Atom non valido');
    $isAtom=strtolower($xml->getName())==='feed';
    $entries=$isAtom?$xml->entry:$xml->channel->item;
    $out=[];
    foreach($entries as $entry) {
        if(count($out)>=$limit)break;
        if($isAtom) {
            $url=''; foreach($entry->link as $link) { $attr=$link->attributes(); if((!isset($attr['rel'])||(string)$attr['rel']==='alternate') && isset($attr['href'])){$url=(string)$attr['href'];break;} }
            $html=(string)($entry->content?:$entry->summary);
            $date=(string)($entry->updated?:$entry->published);
        } else {
            $url=(string)$entry->link;
            $enc=$entry->children('http://purl.org/rss/1.0/modules/content/');
            $html=(string)($enc->encoded ?: $entry->description);
            $date=(string)$entry->pubDate;
        }
        if (!sf_public_url($url)) continue;
        $title=sf_strip((string)$entry->title);if(!$title)continue;
        $img='';$media=$entry->children('http://search.yahoo.com/mrss/');
        foreach($media->content as $node) { $a=$node->attributes();if(isset($a['url'])&&(!isset($a['medium'])||(string)$a['medium']==='image')){$img=(string)$a['url'];break;} }
        if (!$img) foreach($media->thumbnail as $node) { $a=$node->attributes();if(isset($a['url'])){$img=(string)$a['url'];break;} }
        if (!$img && !$isAtom) foreach($entry->enclosure as $enc) { $a=$enc->attributes();if(isset($a['url'])&&preg_match('~^image/~i',(string)$a['type'])){$img=(string)$a['url'];break;} }
        if (!$img) $img=sf_img_in_html($html);
        $out[]=['id'=>substr(sha1($url),0,12),'title'=>$title,'url'=>$url,'date'=>$date,'image'=>sf_image_url($img)];
    }
    return $out;
}

$action=$_GET['action']??'';
if($action==='feed') {
    $site=trim((string)($_GET['site']??''));
    $n=max(1,min(30,(int)($_GET['n']??20)));
    if(!sf_public_url($site))sf_error(400,'Inserisci un URL pubblico valido, per esempio https://wordpress.org/news');
    $p=parse_url($site);
    $origin=$p['scheme'].'://'.$p['host'];
    $path=rtrim($p['path']??'','/');
    $prefix=$origin.$path;
    $errors=[];

    // Parametro anti-cache (_t) + ordinamento esplicito per data decrescente
    $ts = time() . mt_rand(100, 999);
    $wpQuery = '?_embed=1&status=publish&orderby=date&order=desc&per_page='.$n.'&_t='.$ts;

    $requests=$path ? [
        ['wp',$prefix.'/wp-json/wp/v2/posts'.$wpQuery],
        ['rss',$prefix.'/feed/?_t='.$ts],
        ['wp',$origin.'/wp-json/wp/v2/posts'.$wpQuery],
        ['rss',$prefix.'/rss/?_t='.$ts]
    ] : [
        ['wp',$origin.'/wp-json/wp/v2/posts'.$wpQuery],
        ['wp',$origin.'/?rest_route=/wp/v2/posts&_embed=1&orderby=date&order=desc&per_page='.$n.'&_t='.$ts],
        ['rss',$origin.'/feed/?_t='.$ts],
        ['rss',$origin.'/rss/?_t='.$ts]
    ];
    foreach($requests as $candidate) {
        [$type,$url]=$candidate;
        try {
            $result=sf_get($url,3*1024*1024,10);
            if($result['status']!==200){$errors[]=$type.' HTTP '.$result['status'];continue;}
            $items=$type==='wp'?sf_wp_items($result['body'],$n):sf_rss_items($result['body'],$n);
            if(!is_array($items) || !$items) {$errors[]=$type.' senza articoli pubblici';continue;}
            echo json_encode(['items'=>$items,'source'=>$type,'feed_url'=>$url],JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);exit;
        } catch(Throwable $e){$errors[]=$type.': '.$e->getMessage();}
    }
    sf_error(502,'Nessun feed pubblico compatibile. Tentativi: '.implode('; ',array_slice($errors,0,4)));
}
if($action==='img') {
    $url=trim((string)($_GET['url']??''));
    if(!sf_public_url($url))sf_error(400,'URL immagine non valido');
    try {
        $response=sf_get($url,10*1024*1024,15);
        if($response['status']!==200)sf_error(502,'Immagine remota HTTP '.$response['status']);
        $mime=strtolower(trim(explode(';',$response['type'])[0]));
        if(!in_array($mime,['image/jpeg','image/png','image/webp','image/gif'],true))sf_error(415,'Risposta remota non è un’immagine supportata');
        header('Content-Type: '.$mime);
        header('Cache-Control: public, max-age=3600');
        echo $response['body'];exit;
    } catch(Throwable $e){sf_error(502,'Impossibile leggere immagine: '.$e->getMessage());}
}
sf_error(400,'Azione non riconosciuta');