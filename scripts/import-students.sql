-- ============================================================
-- ייבוא מתאמנים ממכללות — הדבק ב-Supabase SQL Editor
-- ============================================================

DO $$
DECLARE
  next_num INTEGER;
  grp_num  INTEGER;
  sid      TEXT;
  eid      TEXT;
  grp_rec  RECORD;
BEGIN

  -- טבלה זמנית לקשר מתאמן ↔ קבוצה
  CREATE TEMP TABLE _grp (grp TEXT, college TEXT, sid TEXT) ON COMMIT DROP;

  -- מספור מתאמנים
  SELECT COALESCE(MAX(SUBSTRING(id FROM 2)::INTEGER), 0) + 1
    INTO next_num FROM students WHERE id ~ '^S\d+$';

  -- ====================
  -- חיפה
  -- ====================
  SELECT id INTO eid FROM students WHERE lower(email)='george79dwery@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'ג''ורג''','','','george79dwery@gmail.com','חיפה','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('חיפה','חיפה',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='mail.12900303@walla.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'דני','','','mail.12900303@walla.com','חיפה','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('חיפה','חיפה',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='isrdanny@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'דני','ישראלי','','isrdanny@gmail.com','חיפה','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('חיפה','חיפה',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='nikolayetsyulia@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'יוליה','ניקולאייץ','','nikolayetsyulia@gmail.com','חיפה','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('חיפה','חיפה',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='thegamer7242@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'מאור','','','thegamer7242@gmail.com','חיפה','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('חיפה','חיפה',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='mickeybg108@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'מיכאל','','','mickeybg108@gmail.com','חיפה','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('חיפה','חיפה',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='549123vi@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'שגיא','לוי','','549123vi@gmail.com','חיפה','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('חיפה','חיפה',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='shumi@netvision.net.il' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'שמעון','כץ','','shumi@netvision.net.il','חיפה','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('חיפה','חיפה',sid);

  -- ללא מייל – חיפה
  sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
  INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'בועז','','','','חיפה','','',true);
  INSERT INTO _grp VALUES('חיפה','חיפה',sid);

  sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
  INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'ינאי','','','','חיפה','','',true);
  INSERT INTO _grp VALUES('חיפה','חיפה',sid);

  -- ====================
  -- אשדוד
  -- ====================
  SELECT id INTO eid FROM students WHERE lower(email)='dav03062003@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'דוד','','','dav03062003@gmail.com','אשדוד','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('אשדוד','אשדוד',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='green22start@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'ויטלי','מרטיאנוב','','green22start@gmail.com','אשדוד','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('אשדוד','אשדוד',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='yulid2008@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'יולי','דונגי','','yulid2008@gmail.com','אשדוד','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('אשדוד','אשדוד',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='yosefgal00@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'יוסף','גל','','yosefgal00@gmail.com','אשדוד','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('אשדוד','אשדוד',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='motiaharoni5@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'מוטי','אהרוני','','motiaharoni5@gmail.com','אשדוד','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('אשדוד','אשדוד',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='omerob1299@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'עומר','','','omerob1299@gmail.com','אשדוד','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('אשדוד','אשדוד',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='omriratzon2507@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'עומרי','רצון','','omriratzon2507@gmail.com','אשדוד','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('אשדוד','אשדוד',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='remoob681@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'קיוסק','סרגיי','','remoob681@gmail.com','אשדוד','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('אשדוד','אשדוד',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='shlomikz10@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'שלומי','קזז','','shlomikz10@gmail.com','אשדוד','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('אשדוד','אשדוד',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='shmoelcoen@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'שמואל','כהן','','shmoelcoen@gmail.com','אשדוד','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('אשדוד','אשדוד',sid);

  sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
  INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'מני','אלן','','','אשדוד','','',true);
  INSERT INTO _grp VALUES('אשדוד','אשדוד',sid);

  -- ====================
  -- פתח תקווה
  -- ====================
  SELECT id INTO eid FROM students WHERE lower(email)='baruch.haim@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'חיים','ברוך','','baruch.haim@gmail.com','פתח תקווה','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('פתח תקווה','פתח תקווה',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='yaniv.oshri@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'יניב','','','yaniv.oshri@gmail.com','פתח תקווה','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('פתח תקווה','פתח תקווה',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='mail.inbal@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'ענבל','לוי','','mail.inbal@gmail.com','פתח תקווה','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('פתח תקווה','פתח תקווה',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='pinialkobi@gmal.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'פיני','אלקובי','','pinialkobi@gmal.com','פתח תקווה','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('פתח תקווה','פתח תקווה',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='tzahikanza@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'צחי','קנזה','','tzahikanza@gmail.com','פתח תקווה','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('פתח תקווה','פתח תקווה',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='mulish@walla.co.il' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'שמוליק','','','mulish@walla.co.il','פתח תקווה','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('פתח תקווה','פתח תקווה',sid);

  -- ====================
  -- כפר סבא א
  -- ====================
  SELECT id INTO eid FROM students WHERE lower(email)='bilan2b@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'אילן','','','bilan2b@gmail.com','כפר סבא','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('כפר סבא א','כפר סבא',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='galili.yaniv@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'יניב','','','galili.yaniv@gmail.com','כפר סבא','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('כפר סבא א','כפר סבא',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='ilan-18@zahav.net.il' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'מנחם','','','ilan-18@zahav.net.il','כפר סבא','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('כפר סבא א','כפר סבא',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='ronenriewer@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'נדב','','','ronenriewer@gmail.com','כפר סבא','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('כפר סבא א','כפר סבא',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='eran.zeze@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'ערן','','','eran.zeze@gmail.com','כפר סבא','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('כפר סבא א','כפר סבא',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='heller.a83@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'רוני','','','heller.a83@gmail.com','כפר סבא','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('כפר סבא א','כפר סבא',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='roeish@windowslive.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'רועי','שקד','','roeish@windowslive.com','כפר סבא','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('כפר סבא א','כפר סבא',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='shacharmalachi77@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'שחר','','','shacharmalachi77@gmail.com','כפר סבא','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('כפר סבא א','כפר סבא',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='shakedgalili536@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'שקד','','','shakedgalili536@gmail.com','כפר סבא','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('כפר סבא א','כפר סבא',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='shakedshavit100@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'שקד','שביט','','shakedshavit100@gmail.com','כפר סבא','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('כפר סבא א','כפר סבא',sid);

  -- ללא מייל – כפר סבא א
  sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
  INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'גולן','צברי','','','כפר סבא','','',true);
  INSERT INTO _grp VALUES('כפר סבא א','כפר סבא',sid);

  sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
  INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'מוטי','','','','כפר סבא','','',true);
  INSERT INTO _grp VALUES('כפר סבא א','כפר סבא',sid);

  sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
  INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'משה','','','','כפר סבא','','',true);
  INSERT INTO _grp VALUES('כפר סבא א','כפר סבא',sid);

  sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
  INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'רון','','','','כפר סבא','','',true);
  INSERT INTO _grp VALUES('כפר סבא א','כפר סבא',sid);

  -- ====================
  -- כפר סבא ב
  -- ====================
  SELECT id INTO eid FROM students WHERE lower(email)='yairm221@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'יאיר','משה','','yairm221@gmail.com','כפר סבא','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('כפר סבא ב','כפר סבא',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='yanir1986@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'יניר','אזולאי','','yanir1986@gmail.com','כפר סבא','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('כפר סבא ב','כפר סבא',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='shlomi@nb-tech.co.il' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'שלומי','','','shlomi@nb-tech.co.il','כפר סבא','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('כפר סבא ב','כפר סבא',sid);

  -- ללא מייל – כפר סבא ב
  sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
  INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'אלעד','כהן','','','כפר סבא','','',true);
  INSERT INTO _grp VALUES('כפר סבא ב','כפר סבא',sid);

  sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
  INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'דוד','ואזנה','','','כפר סבא','','',true);
  INSERT INTO _grp VALUES('כפר סבא ב','כפר סבא',sid);

  sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
  INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'חנן','ברנס','','','כפר סבא','','',true);
  INSERT INTO _grp VALUES('כפר סבא ב','כפר סבא',sid);

  sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
  INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'שלמה','','','','כפר סבא','','',true);
  INSERT INTO _grp VALUES('כפר סבא ב','כפר סבא',sid);

  -- ====================
  -- תל אביב
  -- ====================
  SELECT id INTO eid FROM students WHERE lower(email)='avimyers.abz@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'Avi','Myers','','avimyers.abz@gmail.com','תל אביב','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('תל אביב','תל אביב',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='oribuzitgod@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'אורי','בוזגלו','','oribuzitgod@gmail.com','תל אביב','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('תל אביב','תל אביב',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='eliran468@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'אלירן','','','eliran468@gmail.com','תל אביב','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('תל אביב','תל אביב',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='benamsalem38@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'בן','אמסלם','','benamsalem38@gmail.com','תל אביב','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('תל אביב','תל אביב',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='kindlerline@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'דורון','קינדלר','','kindlerline@gmail.com','תל אביב','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('תל אביב','תל אביב',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='lielm112233@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'ליאל','','','lielm112233@gmail.com','תל אביב','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('תל אביב','תל אביב',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='limor.c.1975@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'לימור','כהן','','limor.c.1975@gmail.com','תל אביב','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('תל אביב','תל אביב',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='liraz.maa@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'לירז','מעטוף','','liraz.maa@gmail.com','תל אביב','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('תל אביב','תל אביב',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='2211moise@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'מואיז','','','2211moise@gmail.com','תל אביב','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('תל אביב','תל אביב',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='ninagof@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'נינה','גופמן','','ninagof@gmail.com','תל אביב','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('תל אביב','תל אביב',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='eran_ta@hotmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'ערן','','','eran_ta@hotmail.com','תל אביב','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('תל אביב','תל אביב',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='ronigattenio@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'רוני','','','ronigattenio@gmail.com','תל אביב','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('תל אביב','תל אביב',sid);

  SELECT id INTO eid FROM students WHERE lower(email)='shukii1701@gmail.com' LIMIT 1;
  IF eid IS NULL THEN sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
    INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'שוקי','','','shukii1701@gmail.com','תל אביב','','',true); ELSE sid:=eid; END IF;
  INSERT INTO _grp VALUES('תל אביב','תל אביב',sid);

  -- ללא מייל – תל אביב
  sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
  INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'יונתן','','','','תל אביב','','',true);
  INSERT INTO _grp VALUES('תל אביב','תל אביב',sid);

  sid:='S'||LPAD(next_num::TEXT,3,'0'); next_num:=next_num+1;
  INSERT INTO students(id,first_name,last_name,phone,email,college_name,subscription_type,general_notes,active) VALUES(sid,'רום','','','','תל אביב','','',true);
  INSERT INTO _grp VALUES('תל אביב','תל אביב',sid);

  -- ====================
  -- יצירת קבוצות
  -- ====================
  SELECT COALESCE(MAX(SUBSTRING(id FROM 5)::INTEGER), 0) + 1
    INTO grp_num FROM groups WHERE id ~ '^GRP-\d+$';

  FOR grp_rec IN SELECT DISTINCT grp, college FROM _grp ORDER BY grp LOOP
    IF NOT EXISTS (SELECT 1 FROM groups WHERE name = grp_rec.grp) THEN
      INSERT INTO groups(id, name, college_name, student_ids)
      VALUES(
        'GRP-'||LPAD(grp_num::TEXT,3,'0'),
        grp_rec.grp,
        grp_rec.college,
        ARRAY(SELECT g.sid FROM _grp g WHERE g.grp = grp_rec.grp)
      );
      grp_num := grp_num + 1;
    ELSE
      UPDATE groups SET
        college_name = grp_rec.college,
        student_ids  = ARRAY(
          SELECT DISTINCT s FROM unnest(
            student_ids ||
            ARRAY(SELECT g.sid FROM _grp g WHERE g.grp = grp_rec.grp)
          ) AS t(s)
        )
      WHERE name = grp_rec.grp;
    END IF;
  END LOOP;

  RAISE NOTICE 'ייבוא הסתיים בהצלחה';
END $$;
