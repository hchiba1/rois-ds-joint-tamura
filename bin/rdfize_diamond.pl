#!/usr/bin/perl -w
use strict;
use File::Basename;
use Getopt::Std;
my $PROGRAM = basename $0;
my $USAGE=
"Usage: $PROGRAM FILE
";

my %OPT;
getopts('', \%OPT);

if (!@ARGV) {
    print STDERR $USAGE;
    exit 1;
}
my ($FILE) = @ARGV;

### Read TSV ###
my $TARGET_TAXON;
if ($FILE =~ /^\d+\-(\d+)_geneid.tsv$/) {
    $TARGET_TAXON = $1;
} else {
    die "$PROGRAM: unknown file format: $FILE\n";
}

my %MAX_SCORE;
open(FH, $FILE) or die "$PROGRAM: cannot open $FILE: $!\n";
while (<FH>) {
    chomp;
    my @f = split(/\t/, $_, -1);
    if (@f != 5) {
        die "$PROGRAM: $_: expected 5 fields\n";
    }
    if (/\-/) {
        die "$PROGRAM: $_: invalid character\n";
    }
    my $score = $f[2];
    my $geneid_1 = $f[3];
    my $geneid_2 = $f[4];
    my $pair = join("-", $geneid_1, $geneid_2);
    if (!defined $MAX_SCORE{$pair} || $score > $MAX_SCORE{$pair}) {
        $MAX_SCORE{$pair} = $score;
    }
}
close FH;

### Create RDF ###
print "\@prefix : <https://plant-oms.dbcls.jp/ontology#> .\n";
print "\@prefix taxid: <http://identifiers.org/taxonomy/> .\n";
print "\@prefix ncbigene: <http://identifiers.org/ncbigene/> .\n";
print "\n";
foreach my $pair (sort keys %MAX_SCORE) {
    my ($geneid_1, $geneid_2) = split("-", $pair);
    my $score = $MAX_SCORE{$pair};
    print "<https://plant-oms.dbcls.jp/diamond/$pair>\n";
    print "    :queryGene ncbigene:$geneid_1 ;\n";
    print "    :targetGene ncbigene:$geneid_2 ;\n";
    print "    :targetTaxon taxid:$TARGET_TAXON ;\n";
    print "    :score $score .\n";
    print "\n";
}
